<#
  validate-providers.ps1
  Quick PowerShell commands to validate API provider keys/endpoints from a shell.

  Usage (locally):
    cd <repo-root>
    pwsh ./scripts/validate-providers.ps1

  Or run individual commands below by copy-paste in PowerShell (Windows PowerShell 5.1 supported).
#>

Write-Host "== Provider validation helper (PowerShell) =="

if (-not $env:API_FOOTBALL_KEY) { Write-Host "Warning: API_FOOTBALL_KEY not set in env" -ForegroundColor Yellow }
if (-not $env:FOOTBALLDATA_KEY) { Write-Host "Warning: FOOTBALLDATA_KEY not set in env" -ForegroundColor Yellow }

Write-Host "\n--- API-Football (API-Sports) - direct v3 endpoint test ---"
try {
  $headers = @{ 'x-apisports-key' = $env:API_FOOTBALL_KEY }
  $url = 'https://v3.football.api-sports.io/status'
  $r = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction Stop
  Write-Host "API-Football status:" ($r | ConvertTo-Json -Depth 2)
} catch {
  Write-Host "API-Football direct v3 test failed:" $_.Exception.Message -ForegroundColor Red
}

Write-Host "\n--- API-Football (RapidAPI wrapper) test ---"
try {
  $headers = @{ 'x-rapidapi-key' = $env:API_FOOTBALL_KEY; 'x-rapidapi-host' = 'api-football-v3.p.rapidapi.com' }
  $url = 'https://api-football-v3.p.rapidapi.com/status'
  $r = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction Stop
  Write-Host "RapidAPI wrapper status:" ($r | ConvertTo-Json -Depth 2)
} catch {
  Write-Host "RapidAPI wrapper test failed:" $_.Exception.Message -ForegroundColor Red
}

Write-Host "\n--- Football-Data.org v4 test ---"
try {
  $headers = @{ 'X-Auth-Token' = $env:FOOTBALLDATA_KEY }
  $url = 'https://api.football-data.org/v4/competitions/PL'
  $r = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction Stop
  Write-Host "Football-Data PL sample:" ($r | ConvertTo-Json -Depth 2)
} catch {
  Write-Host "Football-Data test failed:" $_.Exception.Message -ForegroundColor Red
}

Write-Host "\n--- SportsMonks TLS / endpoint quick test ---"
try {
  if (-not $env:SPORTSMONKS_KEY) { Write-Host "SPORTSMONKS_KEY not set" -ForegroundColor Yellow } else {
    $url = "https://soccer.sportmonks.com/api/v2.0/leagues?api_token=$($env:SPORTSMONKS_KEY)"
    $r = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
    Write-Host "SportsMonks sample:" ($r | ConvertTo-Json -Depth 2)
  }
} catch {
  Write-Host "SportsMonks test failed:" $_.Exception.Message -ForegroundColor Red
}

Write-Host "\n--- SofaScore (RapidAPI) quick test ---"
try {
  if (-not $env:SOFASCORE_KEY) { Write-Host "SOFASCORE_KEY not set" -ForegroundColor Yellow } else {
    $headers = @{ 'x-rapidapi-key' = $env:SOFASCORE_KEY; 'x-rapidapi-host' = 'sofascore.p.rapidapi.com' }
    $url = 'https://sofascore.p.rapidapi.com/teams/list'
    $r = Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction Stop
    Write-Host "SofaScore sample: received keys" ($r | Get-Member -MemberType NoteProperty | Select-Object -First 10 | Format-Table -AutoSize)
  }
} catch {
  Write-Host "SofaScore test failed:" $_.Exception.Message -ForegroundColor Red
}

Write-Host "\n--- SportsData.io (sample) ---"
try {
  if (-not $env:SPORTSDATA_KEY) { Write-Host "SPORTSDATA_KEY not set" -ForegroundColor Yellow } else {
    $url = "https://api.sportsdata.io/v3/soccer/scores/json/Competitions?key=$($env:SPORTSDATA_KEY)"
    $r = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
    Write-Host "SportsData sample: returned count" ($r | Measure-Object).Count
  }
} catch {
  Write-Host "SportsData test failed:" $_.Exception.Message -ForegroundColor Red
}

Write-Host '\n== Done. If you run this on Render, ensure env vars are set in the Render dashboard or use the Render Shell to echo them.' -ForegroundColor Green
