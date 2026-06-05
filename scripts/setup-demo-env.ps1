$root = Split-Path -Parent $PSScriptRoot

$envFiles = @{
  "webhook-service\.env" = @"
PORT=3001
VERIFY_TOKEN=demo_verify_token
FACEBOOK_VERIFY_TOKEN=demo_verify_token
APP_SECRET=demo_app_secret
FACEBOOK_APP_SECRET=demo_app_secret
KAFKA_BROKER=localhost:19092
"@
  "core-service\.env" = @"
PORT=3002
KAFKA_BROKER=localhost:19092
AI_PROVIDER=FALLBACK
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=30000
AI_TIMEOUT=10000
"@
  "backend-api\.env" = @"
PORT=3000
KAFKA_BROKER=localhost:19092
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fb_api_db
DB_USER=fb_api_user
DB_PASSWORD=fb_api_password
JWT_SECRET=demo_jwt_secret
ADMIN_USER=admin
ADMIN_PASS=admin123
PAGE_ID=demo_page_001
PAGE_ACCESS_TOKEN=demo_page_access_token
MOCK_FACEBOOK_API=true
SIMULATE_FACEBOOK_FAILURES=0
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=30000
"@
  "retry-service\.env" = @"
PORT=3003
KAFKA_BROKER=localhost:19092
MAX_RETRY=3
"@
}

foreach ($relativePath in $envFiles.Keys) {
  $target = Join-Path $root $relativePath
  Set-Content -LiteralPath $target -Value $envFiles[$relativePath] -Encoding UTF8
  Write-Host "Wrote $relativePath"
}

Write-Host ""
Write-Host "Demo env ready."
Write-Host "For DLQ demo, set backend-api\.env SIMULATE_FACEBOOK_FAILURES=99, then restart npm run demo:bai3."
