# Chạy thử đo p95 ngoài Docker (NFR-01)

**Chưa phải minh chứng NFR-01.** Lần này chạy BrewLite API bằng `node dist/main.js` (`NODE_ENV=production`, `LOG_LEVEL=info`, giống biến trong `docker-compose.yml`) với PostgreSQL 17 chạy trực tiếp trên máy (gói `embedded-postgres`; compose dùng `postgres:16`), vì máy đo chưa cài Docker. SRS yêu cầu chạy bằng `docker-compose`; dùng kết quả này để kiểm tra script, không thay cho lần đo trong Docker Compose.

- Thời điểm: 2026-11-15T06:46:32.365Z
- API: http://localhost:3001
- Máy đo: Windows_NT 10.0.26200, 12th Gen Intel(R) Core(TM) i5-12450H, 12 luồng, RAM 15.7 GB; Node v24.13.0
- Mỗi API gọi 100 lần liên tiếp (gọi xong lần trước mới gửi lần sau), không có lượt khởi động bỏ qua. Thời gian tính từ lúc gửi request tới lúc đọc hết body, đo ở máy gọi.
- p95 tính theo nearest-rank: giá trị thứ ceil(0,95 × n) sau khi sắp tăng dần. Ngưỡng: p95 < 500 ms.

| API | Số lần | Min (ms) | Trung vị (ms) | p95 (ms) | Max (ms) | Mã HTTP | Đạt |
|---|---|---|---|---|---|---|---|
| `GET /products` | 100 | 1.2 | 1.6 | 2.5 | 4.2 | 200×100 | Đạt |
| `GET /products/:id` | 100 | 1.9 | 2.4 | 3.6 | 3.8 | 200×100 | Đạt |
| `POST /orders/checkout` | 100 | 6.2 | 7.7 | 9.6 | 40.6 | 201×100 | Đạt |
| `POST /orders/{id}/payments` | 100 | 3.9 | 8.6 | 11.1 | 25.3 | 200×93, 202×7 | Đạt |

Kết quả thanh toán do bộ mô phỏng chọn: SUCCEEDED 74, PROCESSING 7, FAILED 19.

**Kết luận:** cả 4 API đạt p95 < 500 ms.
