# Facebook Page API & AI Automation Pipeline (Monorepo)

Hệ thống phân tán quản lý Facebook Page tự động hóa quy trình phân loại và phản hồi bình luận tích hợp AI, được xây dựng theo kiến trúc Event-Driven sử dụng Apache Kafka, PostgreSQL, Prometheus, Alertmanager và Docker.

---

## 🗺️ Kiến trúc Hệ thống & Luồng Dữ liệu

```
[Facebook Page User Comment]
             │
             ▼ (Webhook Event)
   [ngrok Secure Tunnel]
             │
             ▼ (HMAC Signature Verified)
      [webhook-service] (Port 3001)
             │
             ▼ Publish to Kafka: "raw_events"
       [core-service] (Port 3002) ───► Phân tích Intent & Sentiment (Gemini/Fallback Rules)
             │
             ▼ Publish to Kafka: "reply_commands" / "manual_review"
       [backend-api] (Port 3000) ◄─── (Kiểm tra Idempotency DB & Circuit Breaker)
             │
             ├─► (Thành công) ──► Gọi Facebook Graph API ──► [Reply/Hide on Facebook]
             │
             └─► (Lỗi tạm thời) ─► Publish to Kafka: "send_failed"
                         │
                         ▼
                  [retry-service] (Port 3003) ──► (Chờ Exponential Backoff)
                         │
                         ├─► (Thử lại < Max Retries) ──► Publish: "send_retry" ──► [backend-api]
                         │
                         └─► (Thử lại >= Max Retries) ─► Publish: "dead_letter" (DLQ)
                                                                 │
                                                                 ▼
                                                        [Prometheus Alert] ──► [Alertmanager]
```

---

## 🗂️ Danh sách các Service & Port kết nối

| Thành phần | Port | Vai trò & Trách nhiệm chính |
| :--- | :---: | :--- |
| **backend-api** | `3000` | Cung cấp Swagger UI, API Proxy tới FB Graph API, Quản lý JWT, tiêu thụ lệnh `reply_commands`/`send_retry` |
| **webhook-service** | `3001` | Tiếp nhận Webhook từ Facebook, xác thực chữ ký HMAC `x-hub-signature-256`, publish `raw_events` |
| **core-service** | `3002` | Tiêu thụ `raw_events`, lọc trùng, phân loại ý định (intent/sentiment) bằng AI (Gemini) hoặc Rule-fallback |
| **retry-service** | `3003` | Tiêu thụ `send_failed`, thực hiện Exponential Backoff, chuyển sang `send_retry` hoặc đẩy vào `dead_letter` |
| **Kafka UI** | `18081` | Giao diện quản trị trực quan xem các Kafka topics và message payload realtime |
| **Prometheus** | `9090` | Thu thập metrics hiệu năng hệ thống và theo dõi trạng thái hàng đợi lỗi (DLQ) |
| **Alertmanager** | `9093` | Gửi cảnh báo hệ thống khi phát hiện có lỗi nghiêm trọng hoặc DLQ tăng đột biến |
| **PostgreSQL** | `5432` | Lưu trữ dữ liệu chống trùng lặp (`idempotency_keys`) và lịch sử tương tác |

---

## 🛠️ Hướng dẫn Cài đặt & Chạy Hệ thống

### 📋 Điều kiện tiên quyết
Máy tính của bạn cần được cài đặt sẵn:
- **Node.js** phiên bản 18 trở lên.
- **Docker Desktop** & **Docker Compose**.
- **ngrok** (đã được cấu hình tài khoản cá nhân).

### Bước 1: Cài đặt Dependencies & Setup Môi trường Demo
Chạy các lệnh sau từ thư mục gốc (`root`):
```powershell
# Cài đặt devDependencies cho thư mục root
npm install

# Tự động cài đặt dependencies cho cả 4 service và khởi tạo các file .env mẫu
npm run setup:fresh
```
*Lưu ý: Mặc định hệ thống sẽ cấu hình chạy ở chế độ giả lập (`MOCK_FACEBOOK_API=true` và `AI_PROVIDER=FALLBACK`) giúp bạn chạy thử nghiệm toàn bộ hệ thống ngay lập tức mà không cần token Facebook hay AI API Key thật.*

### Bước 2: Khởi động Hạ tầng Docker & Khởi tạo Kafka Topics
Hãy chắc chắn Docker Desktop của bạn đang hoạt động, sau đó chạy:
```powershell
# Bật các container hạ tầng (Kafka, Postgres, Prometheus...)
npm run infra:up

# Tạo trước các Kafka topics cần thiết
npm run topics:create
```

Các topic Kafka sẽ được khởi tạo bao gồm:
* `raw_events`, `reply_commands`, `manual_review`, `send_failed`, `send_retry`, `dead_letter`.

Bạn có thể kiểm tra danh sách container qua lệnh:
```powershell
docker compose ps
```
Hoặc truy cập giao diện quản trị Kafka UI tại: **[http://localhost:18081](http://localhost:18081)**

### Bước 3: Khởi chạy 4 Services Đồng thời
```powershell
npm run demo:bai3
```
Kiểm tra trạng thái hoạt động (Health Check) của các dịch vụ:
```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3001/health
Invoke-RestMethod http://localhost:3002/health
Invoke-RestMethod http://localhost:3003/health
```

---

## 📘 Hướng dẫn Trình diễn tính năng (Demo Flows)

### 1. Bài 1: Quản trị Backend API & Swagger UI
* Truy cập trang tài liệu API: **[http://localhost:3000/api-docs](http://localhost:3000/api-docs)**
* **Đăng nhập quản trị**:
  * Gọi API `POST /auth/login` với thông tin mặc định: `{ "username": "admin", "password": "admin123" }`
  * Sao chép chuỗi `access_token` từ phản hồi trả về.
  * Nhấp vào nút **Authorize** ở góc trên cùng của Swagger và dán token vừa copy vào (chỉ dán token, không cần điền từ khóa `Bearer`).
* **Trình diễn API Proxy**:
  * `GET /posts`: Lấy danh sách bài đăng từ Facebook Page.
  * `POST /post`: Đăng bài viết mới với nội dung tùy chọn.
  * `GET /comments?post_id=<id_bai_viet>`: Lấy danh sách bình luận của bài viết.

#### Lệnh gọi API mẫu (bằng cURL):
```bash
# Đăng nhập lấy token JWT
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"

# Lấy danh sách bài viết
curl http://localhost:3000/posts \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

### 2. Bài 2 & 3: Luồng Webhook & Phân Loại AI Tự Động
Hệ thống sử dụng cơ chế chữ ký bảo mật HMAC để xác minh dữ liệu Webhook từ Meta.

#### Khởi chạy ngrok cho cổng webhook (Port 3001):
Mở một terminal mới độc lập tại thư mục root và chạy:
```powershell
npm run ngrok:webhook
```
Sao chép URL HTTPS của ngrok (ví dụ: `https://abc-123.ngrok-free.app`).

#### Xác thực webhook cục bộ (Local Verification):
```powershell
Invoke-WebRequest "http://localhost:3001/webhook?hub.mode=subscribe&hub.verify_token=fb_lab_verify_123&hub.challenge=CHALLENGE_OK"
```
Kết quả mong muốn trả về trong terminal: `CHALLENGE_OK`

#### Giả lập gửi bình luận từ Webhook với chữ ký HMAC:
Chạy các lệnh giả lập bình luận sau từ thư mục `webhook-service` để quan sát luồng xử lý tự động trong Kafka UI:

```powershell
cd .\webhook-service
$env:APP_SECRET="a19467b6d1c974d35db325fcdac7d644"

# Case 1: Hỏi giá (Hệ thống tự động Reply báo giá)
$env:DEMO_MESSAGE="Shop oi gia bao nhieu?"
npm run demo:send-webhook

# Case 2: Khen ngợi (Hệ thống tự động Reply cảm ơn)
$env:DEMO_MESSAGE="Bai viet hay qua, shop tu van rat tot"
npm run demo:send-webhook

# Case 3: Khiếu nại (Hệ thống tự động Reply xin lỗi và chuyển hỗ trợ)
$env:DEMO_MESSAGE="Dich vu te qua, minh cho rat lau"
npm run demo:send-webhook

# Case 4: Bình luận chứa link spam (Tự động ẨN bình luận + đưa vào mục duyệt thủ công)
$env:DEMO_MESSAGE="Nhan qua tai http://spam.example"
npm run demo:send-webhook

cd ..
```

*Quan sát Kafka UI ở từng case để thấy message được gửi tuần tự qua các topic `raw_events` -> Phân loại AI -> `reply_commands` / `manual_review`.*

---

### 3. Trình diễn Khả năng chịu lỗi & DLQ (Resilience)

#### Cơ chế Retry & Dead Letter Queue (DLQ)
1. Cấu hình file `backend-api/.env` để kích hoạt giả lập lỗi Facebook:
   ```env
   SIMULATE_FACEBOOK_FAILURES=99
   ```
2. Khởi động lại dịch vụ (`npm run demo:bai3`) và gửi lại bình luận hỏi giá.
3. **Kết quả**:
   * API gọi Facebook thất bại và đẩy message lỗi vào topic `send_failed`.
   * `retry-service` nhận được và tiến hành đợi theo luật Exponential Backoff (`1s -> 2s -> 4s`) rồi đẩy sang `send_retry` để backend gọi lại.
   * Sau khi quá `MAX_RETRY=3` lần thất bại, message được chuyển vào topic `dead_letter` (DLQ).
   * Prometheus thu thập chỉ số và hiển thị cảnh báo tại: **[http://localhost:9090/alerts](http://localhost:9090/alerts)**.

#### Cơ chế Circuit Breaker
Khi Facebook API xảy ra lỗi liên tục vượt ngưỡng cho phép, Circuit Breaker trong `backend-api` sẽ chuyển trạng thái từ **CLOSED** sang **OPEN** để tạm ngưng gọi trực tiếp lên Facebook API nhằm bảo vệ hệ thống:
```txt
[CIRCUIT BREAKER] [FACEBOOK API] State transition: CLOSED ---> OPEN
```

#### Cơ chế Chống trùng lặp (Idempotency)
Tất cả các `command_id` xử lý thành công sẽ lưu vào PostgreSQL. Nếu Kafka gửi lại một tin nhắn trùng lặp, backend sẽ nhận biết và thông báo bỏ qua:
```txt
[IDEMPOTENCY] Duplicate command detected for commandId: ...
```
Kiểm tra trực tiếp trong DB:
```powershell
docker exec -it fb_api_postgres psql -U fb_api_user -d fb_api_db -c "select * from idempotency_keys order by created_at desc limit 5;"
```

---

## 🔌 Cấu hình Tích hợp Facebook App & Page Thật
Để triển khai hệ thống tương tác với dữ liệu Facebook thật, bạn cần thay đổi giá trị trong các file `.env` của các service tương ứng:

### 1. `backend-api/.env`
```env
MOCK_FACEBOOK_API=false
PAGE_ID=facebook_page_id_that_cua_ban
PAGE_ACCESS_TOKEN=page_access_token_hop_le_tu_meta
```
*Token của bạn cần có các quyền tối thiểu: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `pages_manage_metadata`.*

### 2. `webhook-service/.env`
```env
VERIFY_TOKEN=verify_token_tu_dat_trung_voi_meta
FACEBOOK_VERIFY_TOKEN=verify_token_tu_dat_trung_voi_meta
APP_SECRET=app_secret_lay_tu_meta_app
FACEBOOK_APP_SECRET=app_secret_lay_tu_meta_app
```

### 3. `core-service/.env` (Tùy chọn AI thật)
```env
AI_PROVIDER=GEMINI
GEMINI_API_KEY=api_key_gemini_hop_le_cua_ban
```

---

## 🛠️ Hướng dẫn Xử lý lỗi thường gặp (Troubleshooting)

* **Lỗi Zookeeper "NodeExistsException" khi khởi động**:
  * Do zookeeper chưa kịp dọn phiên làm việc cũ. Hãy dọn sạch container và volume bằng lệnh:
    ```powershell
    docker compose down -v
    npm run infra:up
    ```
* **Lỗi Webhook POST trả về mã 403 (INVALID_SIGNATURE)**:
  * Do `APP_SECRET` trong file `webhook-service/.env` không khớp với giá trị khóa bí mật của Facebook App đang gửi webhook hoặc khóa dùng để hash message test. Hãy cập nhật lại và khởi động lại dịch vụ.
* **Không tìm thấy Kafka Broker (`Broker may not be available`)**:
  * Kiểm tra xem Docker Desktop đã được mở chưa và các container đã hoạt động hoàn tất hay chưa thông qua giao diện UI của Docker Desktop.
