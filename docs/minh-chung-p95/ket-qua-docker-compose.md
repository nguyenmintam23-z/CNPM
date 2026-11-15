# Kết quả đo p95 (NFR-01)

- Thời điểm: 2026-11-15T07:53:00.815Z
- API: http://localhost:3001
- Môi trường: project Compose riêng `docker compose -p brewlite-p95 up --build -d` từ volume trống, seed bằng `docker compose -p brewlite-p95 exec -e SEED_STAFF_PASSWORD=… -e SEED_MANAGER_PASSWORD=… api npx prisma db seed` (theo `README.md` cùng thư mục). Mã nguồn: `main` commit `e446383`. Docker Desktop 4.99 (Engine 29.9.3, Compose 5.7.0, WSL 2; máy ảo Docker 12 CPU, 7,6 GB RAM). Container: `api` Node v22.23.5 (`NODE_ENV=production`, `LOG_LEVEL=info`), `db` PostgreSQL 16.16, `web` chạy cùng lúc nhưng script gọi thẳng `api` ở cổng 3001.
- Máy đo: Windows_NT 10.0.26200, 12th Gen Intel(R) Core(TM) i5-12450H, 12 luồng, RAM 15.7 GB; Node v24.13.0
- Mỗi API gọi 100 lần liên tiếp (gọi xong lần trước mới gửi lần sau), không có lượt khởi động bỏ qua. Thời gian tính từ lúc gửi request tới lúc đọc hết body, đo ở máy gọi.
- p95 tính theo nearest-rank: giá trị thứ ceil(0,95 × n) sau khi sắp tăng dần. Ngưỡng: p95 < 500 ms.

| API | Số lần | Min (ms) | Trung vị (ms) | p95 (ms) | Max (ms) | Mã HTTP (mong đợi) | Đạt |
|---|---|---|---|---|---|---|---|
| `GET /products` | 100 | 2.4 | 3.0 | 4.2 | 5.2 | 200×100 (200) | Đạt |
| `GET /products/:id` | 100 | 3.1 | 3.9 | 5.0 | 7.7 | 200×100 (200) | Đạt |
| `POST /orders/checkout` | 100 | 9.3 | 11.1 | 13.5 | 18.8 | 201×100 (201) | Đạt |
| `POST /orders/{id}/payments` | 100 | 7.6 | 13.7 | 17.0 | 22.9 | 200×90, 202×10 (200/202) | Đạt |

Kết quả thanh toán do bộ mô phỏng chọn: SUCCEEDED 75, FAILED 15, PROCESSING 10.

**Kết luận:** Cả 4 API đủ 100 mẫu, đúng mã HTTP và p95 < 500 ms.
