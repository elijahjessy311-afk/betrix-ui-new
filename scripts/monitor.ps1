# scripts/monitor.ps1
# Usage: .\scripts\monitor.ps1 -botToken "<BOT_TOKEN>" -redisHost "127.0.0.1" -redisPort 6379 -queueKey "your:queue:key"
param(
  [Parameter(Mandatory=$true)][string]$botToken,
  [string]$redisHost = "127.0.0.1",
  [int]$redisPort = 6379,
  [string]$queueKey = "queue:telegram:updates",
  [int]$intervalSec = 60
)

Write-Host "Starting monitor: polling Telegram getWebhookInfo and Redis LLEN every $intervalSec seconds"
while ($true) {
  try {
    $info = Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/getWebhookInfo" -Method Get -ErrorAction Stop
    $pending = $info.result.pending_update_count
    Write-Host "$(Get-Date -Format o) pending_update_count=$pending"
  } catch {
    Write-Host "$(Get-Date -Format o) getWebhookInfo failed: $($_.Exception.Message)" -ForegroundColor Red
  }

  try {
    # requires redis-cli in PATH; fallback if not available
    $redisCli = Get-Command redis-cli -ErrorAction SilentlyContinue
    if ($redisCli) {
      $llen = & redis-cli -h $redisHost -p $redisPort LLEN $queueKey 2>$null
      Write-Host "$(Get-Date -Format o) redis LLEN $queueKey = $llen"
    } else {
      Write-Host "$(Get-Date -Format o) redis-cli not found; skipping Redis check" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "$(Get-Date -Format o) Redis check failed: $($_.Exception.Message)" -ForegroundColor Red
  }

  Start-Sleep -Seconds $intervalSec
}
