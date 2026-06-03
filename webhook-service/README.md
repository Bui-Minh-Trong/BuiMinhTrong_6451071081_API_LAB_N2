# Webhook Service

Dịch vụ tiếp nhận webhook từ Facebook Page và chuyển tiếp các sự kiện thô vào hệ thống qua Kafka topic `raw_events`.

## Yêu cầu
- Node.js >= 18
- npm

## Cấu hình
1. Tạo file `.env` từ `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Điền các giá trị cấu hình tương ứng trong file `.env`.

## Cài đặt và Chạy

### Chạy độc lập
```bash
# Cài đặt dependencies
npm install

# Chạy ở chế độ production
npm start

# Chạy ở chế độ development với nodemon
npm run dev
```

## API Endpoints

### 1. Health check
- **Endpoint:** `GET /health`
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "service": "webhook-service"
    },
    "error": null,
    "timestamp": "ISO8601"
  }
  ```

### 2. Xác thực Webhook (Facebook GET)
- **Endpoint:** `GET /webhook`
- **Query params:**
  - `hub.mode` (phải là `subscribe`)
  - `hub.verify_token` (phải khớp với `VERIFY_TOKEN` trong `.env`)
  - `hub.challenge` (mã ngẫu nhiên Facebook gửi)
- **Response:** Trả về plain text chứa `hub.challenge`.

### 3. Tiếp nhận sự kiện Webhook (Facebook POST)
- **Endpoint:** `POST /webhook`
- **Headers:**
  - `x-hub-signature-256` (Chữ ký SHA256 được tạo bằng `APP_SECRET` của Facebook App)
- **Response:** Trả về `200 OK` ngay lập tức, sau đó xử lý bất đồng bộ để gửi sang Kafka topic `raw_events`.
