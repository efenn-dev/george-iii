$logFile = "C:\Users\efenn\.openclaw\workspace\gateway-watchdog.log"
$cbFile = "C:\Users\efenn\.openclaw\workspace\CIRCUIT_BREAKER.md"
$maxRetries = 1

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$ts] $msg" -Encoding ASCII
    $lines = @(Get-Content $logFile -ErrorAction SilentlyContinue)
    if ($lines.Count -gt 200) { $lines | Select-Object -Last 100 | Set-Content $logFile -Encoding ASCII }
}

# Check circuit breaker - if STOP, do nothing
if (Test-Path $cbFile) {
    $cb = Get-Content $cbFile -Raw
    if ($cb -match 'status:\s*STOP') { exit 0 }
}

# Check Gateway health
$gwOk = $false
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:18789/health" -Method GET -TimeoutSec 5 -ErrorAction Stop | Out-Null
    $gwOk = $true
} catch { }

if (-not $gwOk) {
    # Check if gateway process exists at all (maybe its starting up)
    $gwProcess = netstat -ano 2>$null | Select-String ":18789"
    if ($gwProcess) {
        # Port is bound but not responding - might be starting up, skip this cycle
        Write-Log "Gateway port bound but not responding - waiting for next cycle"
        exit 0
    }

    Write-Log "Gateway DOWN - attempting silent restart"
    
    # Use the gateway.cmd directly via wscript to avoid flashing
    $vbsRestart = "C:\Users\efenn\.openclaw\gateway-restart-silent.vbs"
    if (-not (Test-Path $vbsRestart)) {
        # Create it on the fly
        $vbs = 'Set WshShell = CreateObject("WScript.Shell")' + "`r`n"
        $vbs += 'WshShell.Run """C:\Users\efenn\.openclaw\gateway.cmd""", 0, False'
        $vbs | Set-Content $vbsRestart -Encoding ASCII
    }
    
    # Only restart if gateway.cmd is not already running
    $nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
    $gwRunning = $nodeProcs | Where-Object { 
        try { $_.CommandLine -match "gateway" } catch { $false }
    }
    
    if (-not $gwRunning) {
        wscript.exe $vbsRestart
        Write-Log "Launched gateway via silent VBS"
    } else {
        Write-Log "Gateway node process exists but port not responding - skipping restart"
    }
}

# Check Mission Control (silent - no flashing possible since its just node)
try {
    Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop | Out-Null
} catch {
    $mcPort = netstat -ano 2>$null | Select-String ":3001.*LISTENING"
    if (-not $mcPort) {
        Write-Log "Mission Control DOWN - restarting silently"
        Start-Process -FilePath "node" -ArgumentList "src/index.js" -WorkingDirectory "C:\Users\efenn\.openclaw\workspace\projects\mission-control\app\server" -WindowStyle Hidden
    }
}

# Kill stuck python processes (over 5 min old)
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
    try { ((Get-Date) - $_.StartTime).TotalMinutes -gt 5 } catch { $false }
} | ForEach-Object {
    Write-Log "Killed stuck python PID $($_.Id)"
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
