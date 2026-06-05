Write-Host "==> Stopping old containers and removing orphans..."
docker compose down --remove-orphans

Write-Host "==> Starting Kafka stack..."
docker compose up -d zookeeper kafka kafka-ui kafka-exporter prometheus alertmanager postgres

Write-Host "==> Waiting for Kafka broker to be ready..."
$maxAttempts = 30
$ready = $false

for ($i = 1; $i -le $maxAttempts; $i++) {
  docker exec fb_api_kafka kafka-topics --list --bootstrap-server kafka:29092 *> $null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }

  Write-Host "Kafka not ready yet ($i/$maxAttempts). Waiting 3s..."
  Start-Sleep -Seconds 3
}

if (-not $ready) {
  Write-Error "Kafka did not become ready. Run: docker compose logs kafka"
  exit 1
}

Write-Host "==> Creating required topics..."
powershell -ExecutionPolicy Bypass -File .\scripts\create-kafka-topics.ps1

Write-Host "==> Current containers:"
docker compose ps

Write-Host ""
Write-Host "Kafka UI: http://localhost:18081"
Write-Host "Kafka broker for Node services: localhost:19092"
