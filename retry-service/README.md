# Retry Service

Dịch vụ quản lý các yêu cầu thất bại và tự động thử lại trong hệ thống Facebook Page:
1. Tiêu thụ các sự kiện lỗi từ topic `send_failed` của Kafka.
2. Tính toán thời gian delay dựa trên số lần thử lại (`retry_count`) theo thuật toán Exponential Backoff: `1000 * Math.pow(2, retry_count) ms`.
3. Chờ đúng thời gian delay trước khi quyết định bước tiếp theo:
   - Nếu `retry_count < MAX_RETRY`: tăng `retry_count`, cập nhật `next_retry_at` và xuất bản sự kiện sang topic `send_retry` để backend-api chạy lại.
   - Nếu `retry_count >= MAX_RETRY`: xuất bản sự kiện sang topic `dead_letter` và ghi nhận nhật ký DLQ.
4. Cung cấp API health check tại cổng 3003.

## Cấu hình
1. Tạo file `.env` từ `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Cập nhật các cấu hình Kafka Broker và ngưỡng thử lại tối đa `MAX_RETRY` nếu cần.

## Cài đặt và Chạy

### Chạy độc lập
```bash
# Cài đặt các gói phụ thuộc
npm install

# Chạy ở chế độ production
npm start

# Chạy ở chế độ development với nodemon
npm run dev
```
