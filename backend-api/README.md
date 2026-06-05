# Backend API Service

Backend API cho Bai 1 dong vai tro proxy giua dashboard quan tri va Facebook Graph API.
Frontend/dashboard chi goi API noi bo nay, khong goi truc tiep den Facebook.

## Chuc nang Bai 1

- `POST /auth/login`: dang nhap admin va nhan JWT.
- `GET /posts`: lay danh sach bai viet cua Page.
- `POST /post`: tao bai viet moi tren Page.
- `GET /comments?post_id=<post_id>`: lay comment cua mot bai viet.
- `GET /comments/:postId`: alias tuong thich cho lay comment theo path.
- `POST /comments/:commentId/reply`: admin tra loi mot comment.
- `POST /comments/:commentId/hide`: admin an mot comment.
- Tat ca API quan tri deu yeu cau `Authorization: Bearer <token>` va role `admin`.

## Cau hinh nhanh cho demo Bai 1

Tao file `.env` tu `.env.example`, sau do dien cac gia tri that:

```env
PORT=3000
ENABLE_DATABASE=false
ENABLE_KAFKA=false
PAGE_ACCESS_TOKEN=your_page_access_token_here
PAGE_ID=your_page_id_here
JWT_SECRET=change_me
ADMIN_USER=admin
ADMIN_PASS=admin123
```

Voi Bai 1, co the tat `ENABLE_DATABASE` va `ENABLE_KAFKA` de backend REST chay doc lap.
Khi sang Bai 2/Bai 3, bat lai hai bien nay va chay day du Docker/Kafka/PostgreSQL.

## Chay server

```bash
npm install
npm run demo:bai1
```

Neu chay trong PowerShell tren Windows va gap loi ExecutionPolicy voi `npm.ps1`, dung:

```powershell
npm.cmd install
npm.cmd run demo:bai1
```

Hoac dung:

```bash
npm run dev
```

## Test tren Swagger UI

Sau khi server chay, mo:

```txt
http://localhost:3000/api-docs
```

Thu tu demo:

1. Mo endpoint `POST /auth/login`, bam **Try it out**, giu body mau `admin/admin123`, bam **Execute**.
2. Copy gia tri `data.access_token` trong response.
3. Bam nut **Authorize** o dau trang Swagger.
4. Dan token vao o Bearer auth. Chi dan token, khong can them chu `Bearer`.
5. Test `GET /posts`.
6. Test `POST /post` voi body mau.
7. Lay `id` bai viet tu response `/posts` hoac `/post`, sau do test `GET /comments?post_id=<post_id>`.

## Lenh demo mau

Dang nhap:

```bash
curl -X POST http://localhost:3000/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

Lay bai viet:

```bash
curl http://localhost:3000/posts ^
  -H "Authorization: Bearer <access_token>"
```

Tao bai viet:

```bash
curl -X POST http://localhost:3000/post ^
  -H "Authorization: Bearer <access_token>" ^
  -H "Content-Type: application/json" ^
  -d "{\"message\":\"Demo Bai 1 - dang bai qua backend proxy\"}"
```

Lay comment:

```bash
curl "http://localhost:3000/comments?post_id=<post_id>" ^
  -H "Authorization: Bearer <access_token>"
```

An comment:

```bash
curl -X POST http://localhost:3000/comments/<comment_id>/hide ^
  -H "Authorization: Bearer <access_token>"
```

## Dinh dang response

Thanh cong:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "timestamp": "2026-06-05T00:00:00.000Z"
}
```

That bai:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FB_TOKEN_EXPIRED",
    "message": "Page access token is expired or invalid.",
    "details": null,
    "retryable": false
  },
  "timestamp": "2026-06-05T00:00:00.000Z"
}
```
