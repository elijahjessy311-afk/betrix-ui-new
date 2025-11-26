<#
PowerShell helper to set production environment variables for BETRIX and run provider checks.
Usage (local):
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  .\scripts\set-prod-env.ps1 -Vars @{
    REDIS_URL='redis://:mypassword@redis.example.com:6379';
    TELEGRAM_TOKEN='123456:ABC-DEF';
    API_FOOTBALL_KEY='your_api_football_key';
    API_FOOTBALL_BASE='https://v3.football.api-sports.io';
    ALLSPORTS_API='your_allsports_rapidapi_key';
    SPORTSDATA_API_KEY='your_sportsdata_key';
    PAYPAL_CLIENT_ID='your_paypal_client_id';
    PAYPAL_CLIENT_SECRET='your_paypal_secret';
  }

This script prints commands to set variables for Render, Heroku, or a local PowerShell session.
It will also run `node scripts/check-providers.js` after setting them in the current session.
#>
param(
  [Parameter(Mandatory=$false)]
  [hashtable]$Vars
)

if ($null -eq $Vars) {
  Write-Host "No vars provided. Example usage is at the top of this script." -ForegroundColor Yellow
  exit 1
}

Write-Host "Setting environment variables in current PowerShell session..." -ForegroundColor Cyan
foreach ($k in $Vars.Keys) {
  $v = $Vars[$k]
  Write-Host "- Setting $k" -ForegroundColor Green
  $env:$k = $v
}

Write-Host "Running provider checks (in current session)..." -ForegroundColor Cyan
node scripts/check-providers.js

Write-Host "If you need to set these on Render, use commands like:" -ForegroundColor Yellow
Write-Host "render services update-env --service-id <service-id> --env-vars \"REDIS_URL=$($Vars['REDIS_URL']) TELEGRAM_TOKEN=$($Vars['TELEGRAM_TOKEN'])\"" -ForegroundColor Magenta
Write-Host "Or on Heroku:" -ForegroundColor Yellow
Write-Host "heroku config:set REDIS_URL=$($Vars['REDIS_URL']) TELEGRAM_TOKEN=$($Vars['TELEGRAM_TOKEN']) --app your-app-name" -ForegroundColor Magenta

Write-Host "Done." -ForegroundColor Cyan
