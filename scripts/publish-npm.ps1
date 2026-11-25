Set-Location 'F:\Private\projects\dsh-dev-tools'
$ErrorActionPreference = 'Continue'

Write-Host 'Identity check...' -ForegroundColor Cyan
$who = (npm whoami --registry https://registry.npmjs.org 2>$null)
if (-not $who) {
  Write-Host 'Not logged in. Running npm login first...' -ForegroundColor Yellow
  npm login --auth-type=web --registry https://registry.npmjs.org
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Login failed (exit $LASTEXITCODE)." -ForegroundColor Yellow
    Write-Host 'Press Enter to close...'
    [void][System.Console]::ReadLine()
    exit $LASTEXITCODE
  }
  $who = (npm whoami --registry https://registry.npmjs.org 2>$null)
}
Write-Host "Logged in as: $($who.Trim())"
if ($who.Trim() -ne 'town233') {
  Write-Host 'Expected town233. Aborting.' -ForegroundColor Yellow
  Write-Host 'Press Enter to close...'
  [void][System.Console]::ReadLine()
  exit 1
}

Write-Host ''
Write-Host 'Publishing dsh-developer-tools@0.1.3 ...' -ForegroundColor Cyan
Write-Host 'When a https://www.npmjs.com/auth/cli/... URL appears, open it and confirm with Windows Hello.' -ForegroundColor Cyan
Write-Host ''
npm publish --access public --registry https://registry.npmjs.org
$code = $LASTEXITCODE
Write-Host ''
if ($code -eq 0) {
  Write-Host 'Publish succeeded.' -ForegroundColor Green
} else {
  Write-Host "Publish failed (exit $code). Copy any URL/error above and send it in chat." -ForegroundColor Yellow
}
Write-Host ''
Write-Host 'Press Enter to close...'
[void][System.Console]::ReadLine()
exit $code
