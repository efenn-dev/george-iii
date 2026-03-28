$resp = Invoke-RestMethod -TimeoutSec 15 -Uri "http://localhost:3001/api/tasks/workflow" -Method Get
Write-Output ($resp.PSObject.Properties.Name -join ', ')
Write-Output ("needs_fix type: " + ($resp.needs_fix.GetType().FullName))
Write-Output ("needs_fix string: [" + $resp.needs_fix + "]")
if ($resp.needs_fix -is [System.Array]) {
  $resp.needs_fix | ConvertTo-Json -Depth 10
}
