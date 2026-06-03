# Facebook Page Management Distributed System (Monorepo)

Hệ thống quản lý Facebook Page phân tán dạng monorepo sử dụng Node.js (Express), Kafka, PostgreSQL, Prometheus và Alertmanager.

---

## 1. Cài đặt Hạ tầng (Docker & ngrok)

### Yêu cầu hệ thống
- Docker Desktop và Docker Compose đã được cài đặt và đang chạy.
- Node.js >= 18 và npm.
- ngrok đã được cài đặt để tiếp nhận webhook từ Facebook.

### Khởi động các dịch vụ hạ tầng
Từ thư mục gốc `fb_api/`, chạy lệnh sau để khởi động Kafka, Zookeeper, PostgreSQL, Prometheus, Alertmanager và các công cụ hỗ trợ:

```bash
docker compose up -d
```

---

## 2. Tạo Kafka Topics

Chạy các lệnh `docker exec` sau để khởi tạo 5 topic cần thiết trên Kafka broker (`fb_api_kafka`):

```bash
# 1. raw_events: Webhook Service -> Core Service
docker exec -it fb_api_kafka kafka-topics --create --topic raw_events --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1

# 2. reply_commands: Core Service -> Backend API
docker exec -it fb_api_kafka kafka-topics --create --topic reply_commands --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1

# 3. send_retry: Retry Service -> Backend API
docker exec -it fb_api_kafka kafka-topics --create --topic send_retry --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1

# 4. send_failed: Backend API -> Retry Service
docker exec -it fb_api_kafka kafka-topics --create --topic send_failed --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1

# 5. dead_letter: Retry Service (DLQ - Không có consumer)
docker exec -it fb_api_kafka kafka-topics --create --topic dead_letter --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
```

Để kiểm tra danh sách các topic đã tạo:
```bash
docker exec -it fb_api_kafka kafka-topics --list --bootstrap-server localhost:9092
```

---

## 3. Tạo bảng cơ sở dữ liệu PostgreSQL

Kết nối vào PostgreSQL (`localhost:5432` với DB `fb_api_db`, User `fb_api_user`, Password `fb_api_password`) và chạy đoạn script SQL sau để khởi tạo cấu trúc bảng:

```sql
-- 1. Bảng cấu hình Facebook Page và Access Tokens
CREATE TABLE IF NOT EXISTS facebook_pages (
    page_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng lưu trữ sự kiện nhận được từ webhook (Hỗ trợ xử lý Idempotent)
CREATE TABLE IF NOT EXISTS processed_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    source VARCHAR(50) DEFAULT 'facebook',
    page_id VARCHAR(255) NOT NULL,
    post_id VARCHAR(255),
    comment_id VARCHAR(255) UNIQUE,
    user_id VARCHAR(255),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng lưu trữ lệnh phản hồi và trạng thái thực thi
CREATE TABLE IF NOT EXISTS reply_commands (
    command_id UUID PRIMARY KEY,
    event_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'reply' hoặc 'hide'
    page_id VARCHAR(255) NOT NULL,
    comment_id VARCHAR(255) NOT NULL,
    reply_text TEXT,
    intent VARCHAR(100), -- 'ask_price', 'complaint', 'compliment', 'spam', 'other'
    sentiment VARCHAR(50), -- 'positive', 'neutral', 'negative'
    status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'SUCCESS', 'FAILED', 'FAILED_DLQ'
    retry_count INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Cài đặt và Cấu hình Dịch vụ

### Cài đặt Dependencies cho tất cả các Service
Chạy lệnh sau tại thư mục gốc để tự động cài đặt `npm install` tuần tự cho 4 services:
```bash
npm run install:all
```

### Cấu hình biến môi trường (`.env`)
Mỗi service cần có file `.env` riêng được copy từ `.env.example`. Dưới đây là các cấu hình tối thiểu:

#### **1. webhook-service/.env** (Port 3001)
```env
PORT=3001
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
FACEBOOK_VERIFY_TOKEN=your_verify_token
```

#### **2. core-service/.env** (Port 3002)
```env
PORT=3002
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fb_api_db
DB_USER=fb_api_user
DB_PASSWORD=fb_api_password
```

#### **3. backend-api/.env** (Port 3000)
```env
PORT=3000
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fb_api_db
DB_USER=fb_api_user
DB_PASSWORD=fb_api_password
```

#### **4. retry-service/.env** (Port 3003)
```env
PORT=3003
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

---

## 5. Chạy Hệ thống

### Bước 1: Mở cổng tiếp nhận Webhook (ngrok)
Facebook yêu cầu webhook phải dùng giao thức HTTPS công khai. Chạy ngrok trỏ đến cổng của `webhook-service` (3001):
```bash
ngrok http 3001
```
Lấy URL dạng `https://xxxx.ngrok-free.app` để đăng ký cấu hình Webhook trên trang nhà phát triển Facebook.

### Bước 2: Khởi chạy tất cả các Service đồng thời
Tại thư mục gốc `fb_api/`, khởi động cả 4 services cùng lúc thông qua `concurrently`:
```bash
npm run dev
```

Bạn cũng có thể chạy riêng lẻ từng service nếu cần:
- Webhook: `npm run start:webhook`
- Core: `npm run start:core`
- Backend: `npm run start:backend`
- Retry: `npm run start:retry`

Để dừng toàn bộ dịch vụ, chỉ cần nhấn `Ctrl+C` trong terminal đang chạy.

---

## 6. Địa chỉ truy cập Dashboard Công cụ

| Dịch vụ / Công cụ | URL truy cập | Mô tả |
| :--- | :--- | :--- |
| **Kafka UI** | [http://localhost:8080](http://localhost:8080) | Quản lý topics, consumers, và messages |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | Truy vấn metrics & giám sát trạng thái alert |
| **Alertmanager** | [http://localhost:9093](http://localhost:9093) | Nhận, nhóm và điều hướng cảnh báo (Slack, Email) |
| **Kafka Broker** | `localhost:9092` | Broker endpoint cho ứng dụng kết nối |
| **PostgreSQL** | `localhost:5432` | Cơ sở dữ liệu lưu cấu hình & lịch sử phản hồi |
| **Webhook Service** | [http://localhost:3001](http://localhost:3001) | Endpoint tiếp nhận sự kiện Facebook |
| **Backend API** | [http://localhost:3000](http://localhost:3000) | API quản trị & gửi phản hồi cho Facebook |
