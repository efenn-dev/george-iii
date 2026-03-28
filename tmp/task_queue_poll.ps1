$ids = 39..52
$results = foreach ($id in $ids) {
  try {
    $resp = Invoke-RestMethod -TimeoutSec 15 -Uri ("http://localhost:3001/api/tasks/{0}/transition" -f $id) -Method Post
    $status = $null
    if ($resp.PSObject.Properties.Name -contains 'status') {
      $status = $resp.status
    } elseif ($resp.PSObject.Properties.Name -contains 'task') {
      $status = $resp.task.status
    }
    if (-not $status) { $status = 'ok' }
    [pscustomobject]@{ id = $id; ok = $true; status = $status }
  } catch {
    [pscustomobject]@{ id = $id; ok = $false; error = $_.Exception.Message }
  }
}
$results | ConvertTo-Json -Depth 5
