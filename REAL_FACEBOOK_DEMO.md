# Demo tren Facebook Page that

File nay dung khi muon demo bang comment that tren Facebook Page, khong dung mock.

## 1. Dieu kien truoc khi demo

Ban can co:

- Facebook Page do ban quan tri.
- Meta Developer App gan voi Page do.
- Docker Desktop dang chay.
- ngrok da login/cai dat.
- Page Access Token co quyen doc post/comment, dang post, reply/hide comment.

Quyen nen xin/cap cho token:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `pages_manage_engagement`
- `pages_manage_metadata`

Neu chi demo noi bo, de App o Development mode va dung tai khoan co role Admin/Developer/Tester trong app de comment. Neu muon nguoi ngoai app comment ma webhook/API van chay on dinh, can chuyen App sang Live va cac permission can duoc Meta approve.

## 2. Lay Page Access Token

Trong Meta Graph API Explorer:

1. Chon dung Facebook App cua ban.
2. Generate User Access Token voi cac permission o tren.
3. Goi:

```txt
GET /me/accounts
```

4. Copy `access_token` cua Page can demo.
5. Copy `id` cua Page lam `PAGE_ID`.

Test token:

```txt
GET /{PAGE_ID}/posts
```

Neu request thanh cong thi token doc post duoc.

## 3. Dien file .env that

### `backend-api/.env`

```env
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

PAGE_ID=page_id_that_cua_ban
PAGE_ACCESS_TOKEN=page_access_token_that_cua_ban
MOCK_FACEBOOK_API=false
SIMULATE_FACEBOOK_FAILURES=0

CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=30000
```

### `webhook-service/.env`

```env
PORT=3001
KAFKA_BROKER=localhost:19092

VERIFY_TOKEN=chuoi_verify_tu_dat
FACEBOOK_VERIFY_TOKEN=chuoi_verify_tu_dat

APP_SECRET=facebook_app_secret_cua_ban
FACEBOOK_APP_SECRET=facebook_app_secret_cua_ban
```

`VERIFY_TOKEN` la chuoi tu dat, dung de Meta verify callback URL. `APP_SECRET` lay trong App Settings > Basic.

### `core-service/.env`

Demo on dinh khong can AI key:

```env
PORT=3002
KAFKA_BROKER=localhost:19092
AI_PROVIDER=FALLBACK
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=30000
AI_TIMEOUT=10000
```

### `retry-service/.env`

```env
PORT=3003
KAFKA_BROKER=localhost:19092
MAX_RETRY=3
```

## 4. Chay infrastructure va service

Tai thu muc root:

```powershell
npm.cmd install
npm.cmd run install:all
npm.cmd run infra:up
npm.cmd run topics:create
npm.cmd run demo:bai3
```

Mo cac UI:

- Swagger: `http://localhost:3000/api-docs`
- Kafka UI: `http://localhost:18081`
- Prometheus: `http://localhost:9090`
- Alertmanager: `http://localhost:9093`

## 5. Chay ngrok

Mo terminal rieng:

```powershell
npm.cmd run ngrok:webhook
```

Copy URL HTTPS, vi du:

```txt
https://abc-123.ngrok-free.app
```

Callback URL tren Meta:

```txt
https://abc-123.ngrok-free.app/webhook
```

Verify token tren Meta phai trung voi `VERIFY_TOKEN` trong `webhook-service/.env`.

Test local truoc:

```powershell
Invoke-WebRequest "http://localhost:3001/webhook?hub.mode=subscribe&hub.verify_token=chuoi_verify_tu_dat&hub.challenge=CHALLENGE_OK"
```

Body dung:

```txt
CHALLENGE_OK
```

## 6. Cau hinh Webhooks tren Meta

Trong Meta Developers:

1. Vao Webhooks.
2. Chon object `Page`.
3. Add callback URL ngrok `/webhook`.
4. Dien verify token.
5. Subscribe field `feed`.
6. Subscribe Page cua ban vao app.

Co the subscribe bang Graph API:

```txt
POST /{PAGE_ID}/subscribed_apps?subscribed_fields=feed&access_token={PAGE_ACCESS_TOKEN}
```

Kiem tra Page da subscribe:

```txt
GET /{PAGE_ID}/subscribed_apps?access_token={PAGE_ACCESS_TOKEN}
```

## 7. Demo comment that

1. Mo mot bai post tren Page.
2. Dung tai khoan phu hop voi mode cua App de comment.
3. Quan sat terminal `webhook-service`: phai thay payload vao va publish `raw_events`.
4. Mo Kafka UI:
   - `raw_events`: co event comment that.
   - `reply_commands`: co lenh `reply` hoac `hide`.
   - `manual_review`: co event neu comment la spam/link.
5. Quan sat comment tren Facebook:
   - Hoi gia/khen/khieu nai: Page reply comment.
   - Spam/link: comment bi hide neu token co quyen va Graph API cho phep.

Comment demo nen dung:

```txt
Shop oi gia bao nhieu?
Bai viet hay qua, shop tu van rat tot
Dich vu te qua, minh cho rat lau
Nhan qua tai http://spam.example
```

## 8. Loi thuong gap

### Meta verify callback that bai

- Kiem tra ngrok con chay khong.
- Callback URL phai ket thuc bang `/webhook`.
- Verify token tren Meta phai trung `VERIFY_TOKEN`.

### Webhook POST bi 403 INVALID_SIGNATURE

- `APP_SECRET` sai hoac khong trung app dang gui webhook.
- Sau khi sua `.env`, restart `npm.cmd run demo:bai3`.

### Kafka UI khong thay raw_events

- Kiem tra Docker Desktop.
- Chay lai `npm.cmd run topics:create`.
- Kiem tra terminal `webhook-service` co log nhan webhook khong.

### Backend khong reply/hide duoc

- `MOCK_FACEBOOK_API` phai la `false`.
- `PAGE_ACCESS_TOKEN` phai la Page token, khong phai User token.
- Token can co `pages_manage_engagement`.
- App Development mode chi nen test voi user co role trong app/Page.

### Swagger Bai 1 bao token loi

- Kiem tra `PAGE_ID`.
- Kiem tra `PAGE_ACCESS_TOKEN`.
- Goi `GET /{PAGE_ID}/posts` trong Graph API Explorer de xac nhan token con dung.
