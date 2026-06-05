# Facebook Page API & AI Automation Pipeline

He thong demo 3 bai lab Lap trinh API:

- Bai 1: Backend API proxy toi Facebook Graph API, co Swagger, login JWT, `GET /posts`, `POST /post`, `GET /comments`.
- Bai 2: Webhook Service nhan event Facebook, verify HMAC, normalize payload va publish Kafka `raw_events`; Core Service classify va publish `reply_commands`/`manual_review`.
- Bai 3: Automation + Retry + Idempotency + Circuit Breaker + Dead Letter Queue + Prometheus/Alertmanager.

## Kien truc service

| Thanh phan | Port | Vai tro |
| --- | ---: | --- |
| backend-api | 3000 | Swagger, API Bai 1, consume `reply_commands`/`send_retry`, goi Facebook Graph API |
| webhook-service | 3001 | Verify webhook, nhan POST `/webhook`, publish `raw_events` |
| core-service | 3002 | Consume `raw_events`, phan loai intent/sentiment/spam, tao command |
| retry-service | 3003 | Consume `send_failed`, exponential backoff, publish `send_retry` hoac `dead_letter` |
| Kafka UI | 18081 | Xem topic/message |
| Prometheus | 9090 | Metric va alert |
| Alertmanager | 9093 | Nhan alert |
| PostgreSQL | 5432 | Luu idempotency va lich su comment |

## 1. Fresh pull: cai dependency va tao .env demo

Yeu cau may co Node.js 18+, Docker Desktop, Docker Compose va ngrok.

```powershell
npm install
npm run setup:fresh
```

Lenh tren se:

- Cai dependency cho 4 service.
- Tao `.env` demo cho `backend-api`, `webhook-service`, `core-service`, `retry-service`.
- Mac dinh `MOCK_FACEBOOK_API=true`, nen chay duoc demo khong can token Facebook that.

Neu muon tu dien key that, copy tu cac file:

- `backend-api/.env.example`
- `webhook-service/.env.example`
- `core-service/.env.example`
- `retry-service/.env.example`

## 2. Chay Docker infrastructure

Mo Docker Desktop truoc, sau do chay:

```powershell
npm run infra:up
npm run topics:create
```

Kafka topics can co:

- `raw_events`
- `reply_commands`
- `manual_review`
- `send_failed`
- `send_retry`
- `dead_letter`

Kiem tra:

```powershell
docker compose ps
```

Mo UI:

- Kafka UI: `http://localhost:18081`
- Prometheus: `http://localhost:9090`
- Alertmanager: `http://localhost:9093`

## 3. Chay ca 4 service

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

Tai khoan demo Swagger:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

## 4. Cau hinh key that trong .env

### `backend-api/.env`

```env
PAGE_ID=facebook_page_id_cua_ban
PAGE_ACCESS_TOKEN=page_access_token_cua_ban
MOCK_FACEBOOK_API=false
JWT_SECRET=chuoi_bi_mat_tu_dat
ADMIN_USER=admin
ADMIN_PASS=mat_khau_tu_dat
```

Khi `MOCK_FACEBOOK_API=false`, Backend API se goi Graph API that.

### `webhook-service/.env`

```env
VERIFY_TOKEN=token_tu_dat_de_meta_verify
FACEBOOK_VERIFY_TOKEN=token_tu_dat_de_meta_verify
APP_SECRET=facebook_app_secret_cua_ban
FACEBOOK_APP_SECRET=facebook_app_secret_cua_ban
```

`VERIFY_TOKEN` la chuoi ban tu dat va dien y chang trong Meta Developers. `APP_SECRET` lay trong Facebook App.

### `core-service/.env`

Demo khong can AI key:

```env
AI_PROVIDER=FALLBACK
```

Neu dung AI that:

```env
AI_PROVIDER=GEMINI
GEMINI_API_KEY=key_cua_ban
```

hoac:

```env
AI_PROVIDER=ANTHROPIC
ANTHROPIC_API_KEY=key_cua_ban
```

### `retry-service/.env`

```env
MAX_RETRY=3
```

## 5. Chay ngrok va cau hinh Meta Webhook

Mo terminal rieng:

```powershell
npm run ngrok:webhook
```

Lay URL HTTPS, vi du:

```txt
https://abc-123.ngrok-free.app
```

Trong Meta Developers, cau hinh callback URL:

```txt
https://abc-123.ngrok-free.app/webhook
```

Verify token dung gia tri trong `webhook-service/.env`, vi du:

```txt
demo_verify_token
```

Test verify local:

```powershell
Invoke-WebRequest "http://localhost:3001/webhook?hub.mode=subscribe&hub.verify_token=demo_verify_token&hub.challenge=CHALLENGE_OK"
```

Neu dung, body tra ve:

```txt
CHALLENGE_OK
```

## 6. Demo nhanh Bai 2 va Bai 3

Gui webhook gia lap co HMAC:

```powershell
cd .\webhook-service
$env:APP_SECRET="demo_app_secret"
$env:DEMO_MESSAGE="Shop oi gia bao nhieu?"
npm run demo:send-webhook
cd ..
```

Quan sat Kafka UI:

- `raw_events`: event da normalize.
- `reply_commands`: command `reply`.

Case automation:

```powershell
cd .\webhook-service
$env:DEMO_MESSAGE="Bai viet hay qua, shop tu van rat tot"
npm run demo:send-webhook
$env:DEMO_MESSAGE="Dich vu te qua, minh cho rat lau"
npm run demo:send-webhook
$env:DEMO_MESSAGE="Nhan qua tai http://spam.example"
npm run demo:send-webhook
cd ..
```

Ket qua:

- Khen: `reply_commands`, `sentiment=positive`.
- Khieu nai: `reply_commands`, `sentiment=negative`.
- Spam/link: `reply_commands` co `action=hide`, dong thoi `manual_review` co `reason=spam_detected`.

## 7. Demo retry, circuit breaker va DLQ

Sua `backend-api/.env`:

```env
SIMULATE_FACEBOOK_FAILURES=99
CIRCUIT_BREAKER_THRESHOLD=2
```

Restart `npm run demo:bai3`, gui lai comment hoi gia. Quan sat Kafka UI:

- `send_failed`
- `send_retry`
- `dead_letter`

Prometheus alert:

```txt
http://localhost:9090/alerts
```

Alert `DeadLetterQueueReceived` bat khi topic `dead_letter` tang offset.

## 8. Tat he thong

Dung terminal dang chay service bang `Ctrl+C`, sau do:

```powershell
npm run infra:down
```

Neu muon xoa volume PostgreSQL/Prometheus de reset sach:

```powershell
docker compose down -v
```
