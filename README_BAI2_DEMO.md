# Demo Bai 2 va Bai 3

Tai lieu nay dung de demo theo mau trinh bay lab:

- Bai 2: `webhook-service -> raw_events -> core-service -> reply_commands/manual_review`.
- Bai 3: `backend-api -> send_failed -> retry-service -> send_retry -> dead_letter`, co idempotency, circuit breaker va alert Prometheus.

## 1. Chuan bi moi truong

Tai thu muc root:

```powershell
npm run demo:env
docker compose up -d
powershell -ExecutionPolicy Bypass -File .\scripts\create-kafka-topics.ps1
```

Mo Kafka UI:

```txt
http://localhost:18081
```

Can thay cac topic:

- `raw_events`
- `reply_commands`
- `manual_review`
- `send_failed`
- `send_retry`
- `dead_letter`

## 2. Chay day du 4 service

```powershell
npm run demo:bai3
```

Health check:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3002/health
Invoke-RestMethod http://localhost:3003/health
```

Swagger Bai 1:

```txt
http://localhost:3000/api-docs
```

## 3. Demo Bai 2 - Webhook va Kafka

Verify webhook:

```powershell
Invoke-WebRequest "http://localhost:3001/webhook?hub.mode=subscribe&hub.verify_token=demo_verify_token&hub.challenge=CHALLENGE_OK"
```

Response body can la:

```txt
CHALLENGE_OK
```

Gui comment hoi gia:

```powershell
cd .\webhook-service
$env:APP_SECRET="demo_app_secret"
$env:DEMO_MESSAGE="Shop oi gia bao nhieu?"
npm run demo:send-webhook
cd ..
```

Kiem tra:

```powershell
Invoke-RestMethod http://localhost:3002/events
```

Trong Kafka UI:

- `raw_events`: co event da normalize.
- `reply_commands`: co command `action=reply`, `intent=ask_price`, `sentiment=neutral`.

## 4. Demo Bai 3 - Automation case

Chay cac case tu thu muc `webhook-service`:

```powershell
$env:DEMO_MESSAGE="Bai viet hay qua, shop tu van rat tot"
npm run demo:send-webhook

$env:DEMO_MESSAGE="Dich vu te qua, minh cho rat lau"
npm run demo:send-webhook

$env:DEMO_MESSAGE="Nhan qua tai http://spam.example"
npm run demo:send-webhook
```

Ket qua mong doi:

- Hoi gia: `reply_commands`, `action=reply`, noi dung bao gia.
- Khen: `reply_commands`, `sentiment=positive`, noi dung cam on.
- Khieu nai: `reply_commands`, `sentiment=negative`, noi dung xin loi.
- Spam/link: `reply_commands` co `action=hide`, dong thoi `manual_review` co `reason=spam_detected`.

Backend dang dung `MOCK_FACEBOOK_API=true`, nen van demo duoc khi khong co Facebook token that.

## 5. Demo retry va Dead Letter Queue

Sua file `backend-api\.env`:

```env
SIMULATE_FACEBOOK_FAILURES=99
```

Restart `npm run demo:bai3`, roi gui lai comment hoi gia:

```powershell
cd .\webhook-service
$env:DEMO_MESSAGE="Shop oi gia bao nhieu?"
npm run demo:send-webhook
cd ..
```

Quan sat Kafka UI:

- `send_failed`: Backend API gui command that bai.
- `send_retry`: Retry Service gui lai sau exponential backoff.
- `dead_letter`: Sau qua `MAX_RETRY=3`, message vao DLQ.

Prometheus/Alertmanager:

```txt
http://localhost:9090/alerts
http://localhost:9093
```

Alert `DeadLetterQueueReceived` se kich hoat khi offset topic `dead_letter` tang.

## 6. Demo circuit breaker

Sua `backend-api\.env`:

```env
SIMULATE_FACEBOOK_FAILURES=99
CIRCUIT_BREAKER_THRESHOLD=2
CIRCUIT_BREAKER_TIMEOUT=30000
```

Restart service va gui nhieu comment reply. Log Backend API se co transition:

```txt
[CIRCUIT BREAKER] [FACEBOOK API] State transition: CLOSED ---> OPEN
```

## 7. Demo idempotency

Backend API luu `command_id` thanh cong vao bang `idempotency_keys`. Neu Kafka deliver lai cung `command_id`, service log:

```txt
[IDEMPOTENCY] Duplicate command detected
```

Bang PostgreSQL:

```powershell
docker exec -it fb_api_postgres psql -U fb_api_user -d fb_api_db -c "select * from idempotency_keys order by created_at desc limit 5;"
```
