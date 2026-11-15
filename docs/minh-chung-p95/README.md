# Minh chứng NFR-01: đo p95 của API

**Yêu cầu** (SRS NFR-01, Must): "Với dữ liệu seed, chạy bằng `docker-compose` ở môi trường local, các API `GET /products`, `GET /products/:id`, tạo đơn và thanh toán có thời gian phản hồi p95 dưới 500 ms qua 100 lần gọi liên tiếp." Issue #40: ghi điều kiện đo và kết quả.

Script: [`tests/perf/do-p95.mjs`](../../tests/perf/do-p95.mjs). Chỉ cần Node 18+, không cài thêm gói.

## Cách đo

1. Chạy Docker Compose từ database trống, theo `README.md` ở thư mục gốc:

   ```bash
   docker compose down -v
   docker compose up --build -d
   ```

   `down -v` xóa volume database cũ, để tồn kho về đúng dữ liệu seed.

2. Đợi `http://localhost:3001/health` trả `{"status":"ok"}`, rồi seed:

   ```bash
   docker compose exec -e SEED_STAFF_PASSWORD=<mật khẩu nhân viên> -e SEED_MANAGER_PASSWORD=<mật khẩu quản lý> api npx prisma db seed
   ```

   Container `api` chạy với `NODE_ENV=production`, nên seed bắt buộc có hai biến mật khẩu này (`prisma/seed.ts`). Lệnh trong `README.md` ở thư mục gốc chưa có hai biến nên seed sẽ dừng với lỗi "Thiếu biến môi trường SEED_STAFF_PASSWORD".

3. Đo và ghi kết quả:

   ```bash
   node tests/perf/do-p95.mjs --out docs/minh-chung-p95/ket-qua-docker-compose.md
   ```

   Lệnh trả mã 0 khi cả 4 API đạt, 1 khi có API không đạt, 2 khi không chuẩn bị được (API chưa chạy, chưa seed, hết hàng).

## Script đo thế nào

| Mục | Cách làm | Nguồn |
|---|---|---|
| 4 API | `GET /products`, `GET /products/:id`, `POST /orders/checkout`, `POST /orders/{id}/payments`, gọi thẳng BrewLite API ở cổng 3001 | NFR-01 |
| 100 lần liên tiếp | Mỗi API 100 lần, gọi xong lần trước mới gửi lần sau; không có lượt khởi động bỏ qua | NFR-01 |
| Thời gian | Từ lúc gửi request tới lúc đọc hết body, đo ở máy gọi | **[Đề xuất]** |
| p95 | Nearest-rank: giá trị thứ ceil(0,95 × 100) = 95 sau khi sắp tăng dần | **[Đề xuất]** |
| Đăng nhập | Mỗi lần chạy đăng ký một tài khoản khách mới; các API trên đều cần đăng nhập (FR-01, NFR-02) | SRS |
| Tạo đơn | Mỗi đơn 1 ly, size đầu tiên nếu món có size, chia vào các món còn nhiều hàng nhất để không hết hàng giữa chừng | **[Đề xuất]** |
| Thanh toán | Ví, khóa mới cho mỗi đơn vừa tạo. Kịch bản do server chọn (FR-07), nên có cả thành công, thất bại và đang xử lý (`202`) | FR-07, FR-15 |

Tạo đơn và thanh toán làm giảm tồn kho. Một database seed mới đủ cho khoảng hai lần chạy; sau đó script dừng và báo hết hàng, khi đó chạy lại từ bước 1.

## Kết quả

| Lần đo | Môi trường | Kết quả |
|---|---|---|
| [Chạy thử ngoài Docker](chay-thu-ngoai-docker.md), 15/11/2026 | API chạy bằng `node`, PostgreSQL trên máy; **chưa đạt điều kiện "chạy bằng docker-compose"** | 4/4 API đạt, p95 lớn nhất 11,1 ms |
| [Docker Compose](ket-qua-docker-compose.md), 15/11/2026 | `docker compose` từ database trống, dữ liệu seed, `main` commit `e446383` | **4/4 API đạt**, p95 lớn nhất 44,1 ms (thanh toán) |

Kết quả dùng làm minh chứng NFR-01 là lần đo bằng Docker Compose. Lần chạy thử ngoài Docker chỉ để kiểm tra script.
