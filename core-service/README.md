# Core Service

Dịch vụ xử lý nghiệp vụ chính của hệ thống:
1. Tiêu thụ sự kiện thô từ `raw_events` topic của Kafka.
2. Kiểm tra spam (liên kết, trùng lặp nội dung trong 24h) và giới hạn tần suất (rate limit > 20 comment/phút).
3. Sử dụng Claude AI để phân tích sắc thái (sentiment) và ý định (intent) của người dùng.
4. Áp dụng quy tắc tự động hóa để quyết định hành động (`reply`, `hide`, `pending_review`).
5. Xuất lệnh phản hồi vào `reply_commands` topic của Kafka.

## Cấu hình
1. Tạo file `.env` từ `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Cập nhật khóa API của Anthropic (`ANTHROPIC_API_KEY`) cùng các tham số cấu hình Circuit Breaker nếu cần.

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
