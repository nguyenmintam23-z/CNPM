# Kết quả đo p95 (NFR-01)

- Thời điểm: 2026-11-15T07:21:57.262Z
- API: http://localhost:3001
- Môi trường: `docker compose up --build -d` từ volume trống (`docker compose down -v` trước), rồi seed bằng `docker compose exec -e SEED_STAFF_PASSWORD=… -e SEED_MANAGER_PASSWORD=… api npx prisma db seed` (mật khẩu ngẫu nhiên, chỉ dùng cho lần đo). Mã nguồn: `main` commit `e446383`. Docker Desktop 4.99 (Engine 29.9.3, Compose 5.7.0, WSL 2; máy ảo Docker 12 CPU, 7,6 GB RAM). Container: `api` Node v22.23.5 (`NODE_ENV=production`, `LOG_LEVEL=info`), `db` PostgreSQL 16.16, `web` chạy cùng lúc nhưng script gọi thẳng `api` ở cổng 3001.
- Máy đo: Windows_NT 10.0.26200, 12th Gen Intel(R) Core(TM) i5-12450H, 12 luồng, RAM 15.7 GB; Node v24.13.0
- Mỗi API gọi 100 lần liên tiếp (gọi xong lần trước mới gửi lần sau), không có lượt khởi động bỏ qua. Thời gian tính từ lúc gửi request tới lúc đọc hết body, đo ở máy gọi.
- p95 tính theo nearest-rank: giá trị thứ ceil(0,95 × n) sau khi sắp tăng dần. Ngưỡng: p95 < 500 ms.

| API | Số lần | Min (ms) | Trung vị (ms) | p95 (ms) | Max (ms) | Mã HTTP | Đạt |
|---|---|---|---|---|---|---|---|
| `GET /products` | 100 | 3.3 | 4.9 | 6.7 | 13.6 | 200×100 | Đạt |
| `GET /products/:id` | 100 | 3.9 | 5.7 | 9.3 | 25.2 | 200×100 | Đạt |
| `POST /orders/checkout` | 100 | 13.0 | 18.4 | 29.9 | 93.4 | 201×100 | Đạt |
| `POST /orders/{id}/payments` | 100 | 12.0 | 28.2 | 44.1 | 71.4 | 200×90, 202×10 | Đạt |

Kết quả thanh toán do bộ mô phỏng chọn: SUCCEEDED 70, PROCESSING 10, FAILED 20.

**Kết luận:** cả 4 API đạt p95 < 500 ms.
