param(
    [switch]$ForceReset,
    [switch]$Resume
)

$workspace = "C:\Users\efenn\.openclaw\workspace"
$cbFile = "$workspace\CIRCUIT_BREAKER.md"
$logFile = "$workspace\loop-breaker.log"

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line -Encoding utf8
}

function Set-CircuitBreaker($status, $reason) {
    $content = Get-Content $cbFile -Raw
    $content = $content -replace 'status: \w+', "status: $status"
    $content | Set-Content $cbFile -Encoding utf8
    Write-Log "Circuit breaker set to $status -- $reason"
}

function Get-CBStatus {
    if (-not (Test-Path $cbFile)) { return "UNKNOWN" }
    $content = Get-Content $cbFile -Raw
    if ($content -match 'status:\s*(\w+)') { return $Matches[1] }
    return "UNKNOWN"
}

function Reset-George {
    Write-Log "Restarting gateway to clear stuck session..."
    try { openclaw gateway restart 2>&1 | Out-Null; Write-Log "Gateway restarted" }
    catch { Write-Log "Gateway restart failed: $_" }
}

if ($ForceReset) {
    Write-Log "=== FORCE RESET BY MASTER E ==="
    Set-CircuitBreaker "STOP" "Manual force reset"
    Reset-George
    Write-Host ""
    Write-Host "George has been STOPPED and reset." -ForegroundColor Red
    Write-Host "To resume: .\loop-breaker.ps1 -Resume" -ForegroundColor Yellow
    exit 0
}

if ($Resume) {
    Set-CircuitBreaker "RUN" "Manually resumed"
    Write-Host "George is back to RUN." -ForegroundColor Green
    exit 0
}

$status = Get-CBStatus
Write-Host "Circuit Breaker: $status"

try {
    $start = Get-Date
    Invoke-RestMethod -Uri "http://127.0.0.1:18789/health" -TimeoutSec 10 | Out-Null
    $ms = [int]((Get-Date) - $start).TotalMilliseconds
    Write-Host "Gateway: OK (${ms}ms)" -ForegroundColor Green
} catch {
    Write-Host "Gateway: NOT RESPONDING" -ForegroundColor Red
}

try {
    Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 5 | Out-Null
    Write-Host "Mission Control: OK" -ForegroundColor Green
} catch {
    Write-Host "Mission Control: DOWN" -ForegroundColor Red
}

Write-Host "No loop detected." -ForegroundColor Green
