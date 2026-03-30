# Watchdog Script for OpenClaw Gateway
# Monitors gateway health and auto-restarts if unresponsive
# Also monitors Mission Control server

$logFile = "$PSScriptRoot\gateway-watchdog.log"
$cbFile = "$PSScriptRoot\CIRCUIT_BREAKER.md"

# Configure your paths here
$openclawPath = "$env:USERPROFILE\.openclaw"
$workspacePath = "$env:USERPROFILE\.openclaw\workspace"
$missionControlPath = "$workspacePath\projects\mission-control\app\server"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$ts] $msg" -Encoding ASCII
    $lines = @(Get-Content $logFile -ErrorAction SilentlyContinue)
    if ($lines.Count -gt 200) { 
        $lines | Select-Object -Last 100 | Set-Content $logFile -Encoding ASCII 
    }
}

# Check circuit breaker - if STOP, do nothing
if (Test-Path $cbFile) {
    $cb = Get-Content $cbFile -Raw
    if ($cb -match 'status:\s*STOP') { 
        Write-Log "Circuit breaker is STOP - skipping watchdog"
        exit 0 
    }
}

# Check Gateway health
$gwOk = $false
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:18789/health" -Method GET -TimeoutSec 5 -ErrorAction Stop | Out-Null
    $gwOk = $true
} catch { }

if (-not $gwOk) {
    Write-Log "Gateway DOWN - attempting restart"
    
    # Check if port is bound but not responding
    $gwProcess = netstat -ano 2>$null | Select-String ":18789"
    if ($gwProcess) {
        Write-Log "Gateway port bound but not responding - waiting"
        exit 0
    }

    # Create silent restart VBS
    $vbsRestart = "$openclawPath\gateway-restart-silent.vbs"
    if (-not (Test-Path $vbsRestart)) {
        $vbs = 'Set WshShell = CreateObject("WScript.Shell")' + "`r`n"
        $vbs += "WshShell.Run `""""$openclawPath\gateway.cmd`"""", 0, False"
        $vbs | Set-Content $vbsRestart -Encoding ASCII
    }
    
    # Only restart if not already running
    $nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
    $gwRunning = $nodeProcs | Where-Object { 
        try { $_.CommandLine -match "gateway" } catch { $false }
    }
    
    if (-not $gwRunning) {
        wscript.exe $vbsRestart
        Write-Log "Launched gateway via silent VBS"
    } else {
        Write-Log "Gateway node exists but port not responding - skipping"
    }
}

# Check Mission Control
try {
    Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop | Out-Null
} catch {
    $mcPort = netstat -ano 2>$null | Select-String ":3001.*LISTENING"
    if (-not $mcPort) {
        Write-Log "Mission Control DOWN - restarting"
        Start-Process -FilePath "node" -ArgumentList "src/index.js" `
            -WorkingDirectory $missionControlPath -WindowStyle Hidden
    }
}

# Kill stuck python processes (over 5 min)
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
    try { ((Get-Date) - $_.StartTime).TotalMinutes -gt 5 } catch { $false }
} | ForEach-Object {
    Write-Log "Killed stuck python PID $($_.Id)"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Write-Log "Watchdog cycle complete"
