# Backend API Service

Dịch vụ quản trị hệ thống và thực thi hành động Facebook Page:
1. Tiêu thụ các lệnh phản hồi từ các topic `reply_commands` và `send_retry` của Kafka.
2. Kiểm tra tính trùng lặp xử lý (Idempotency) dựa trên `command_id` được lưu trữ trong PostgreSQL.
3. Gọi trực tiếp Facebook Graph API thông qua Axios (được bọc trong Circuit Breaker) để gửi phản hồi (`reply`) hoặc ẩn comment (`hide`).
4. Nếu thực thi Facebook API thất bại, gửi message lỗi sang topic `send_failed` để lên lịch retry.
5. Cung cấp API RESTful cho dashboard: Đăng nhập quản trị (JWT), lấy danh sách bài viết, tạo bài viết mới, lấy danh sách comment trực tiếp từ Facebook và lấy lịch sử comment đã xử lý từ DB có phân trang/lọc.

## Cấu hình
1. Tạo file `.env` từ `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Điền chính xác các cấu hình kết nối PostgreSQL, Kafka, JWT Secret, thông tin quản trị và Facebook Page Token.

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

## API Endpoints quản trị (JWT Protected)

- **Đăng nhập:** `POST /auth/login` (Body: `{ username, password }`)
- **Lấy bài viết:** `GET /posts` (Header: `Authorization: Bearer <token>`)
- **Đăng bài viết mới:** `POST /post` (Header: `Authorization: Bearer <token>`, Body: `{ message }`)
- **Lấy bình luận bài viết (từ FB):** `GET /comments/:postId` (Header: `Authorization: Bearer <token>`)
- **Xem bình luận đã xử lý (từ DB):** `GET /dashboard/comments` (Header: `Authorization: Bearer <token>`, Query params: `page`, `limit`, `status`, `sentiment`)
