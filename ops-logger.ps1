# ops-logger.ps1 — Append entries to ops-log.json
# Usage: .\ops-logger.ps1 -Action "spawn-coder" -Detail "Building etsy pack script" -Agent "coding" -Status "ok"
# Usage: .\ops-logger.ps1 -Action "api-call" -Detail "Searched web for Etsy SEO" -Agent "research" -Status "cached"

param(
    [Parameter(Mandatory)][string]$Action,
    [Parameter(Mandatory)][string]$Detail,
    [string]$Agent = "george",
    [string]$Status = "ok",
    [string]$LogFile = "C:\Users\efenn\.openclaw\workspace\ops-log.json"
)

$log = Get-Content $LogFile -Raw | ConvertFrom-Json

$entry = [PSCustomObject]@{
    timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssK")
    agent     = $Agent
    action    = $Action
    detail    = $Detail
    status    = $Status
}

$log.entries += $entry

# Keep max 500 entries (rotate oldest)
if ($log.entries.Count -gt 500) {
    $log.entries = $log.entries | Select-Object -Last 500
}

$log | ConvertTo-Json -Depth 5 | Set-Content $LogFile -Encoding utf8
Write-Host "[$($entry.timestamp)] $Agent :: $Action :: $Status :: $Detail"
