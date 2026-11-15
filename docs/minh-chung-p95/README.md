# Minh chứng NFR-01: đo p95 của API

**Yêu cầu** (SRS NFR-01, Must): "Với dữ liệu seed, chạy bằng `docker-compose` ở môi trường local, các API `GET /products`, `GET /products/:id`, tạo đơn và thanh toán có thời gian phản hồi p95 dưới 500 ms qua 100 lần gọi liên tiếp." Issue #40: ghi điều kiện đo và kết quả.

Script: [`tests/perf/do-p95.mjs`](../../tests/perf/do-p95.mjs). Chỉ cần Node 18+, không cài thêm gói.

## Cách đo

Lần đo chạy trong một project Compose riêng tên `brewlite-p95`, có volume database riêng, nên không đụng dữ liệu của môi trường dev (project mặc định). Hai project dùng chung cổng 3000, 3001 nên phải dừng project dev trước.

1. Dừng project dev (giữ nguyên dữ liệu), rồi chạy project đo từ database trống:

   ```bash
   docker compose stop
   docker compose -p brewlite-p95 down -v
   docker compose -p brewlite-p95 up --build -d
   ```

   `down -v` ở đây chỉ xóa volume của project `brewlite-p95` (lần đo trước, nếu có), để tồn kho về đúng dữ liệu seed.

2. Đợi `http://localhost:3001/health` trả `{"status":"ok"}`, rồi seed:

   ```bash
   docker compose -p brewlite-p95 exec -e SEED_STAFF_PASSWORD='Staff@12345' -e SEED_MANAGER_PASSWORD='Manager@12345' api npx prisma db seed
   ```

   Container `api` chạy với `NODE_ENV=production`, nên seed bắt buộc có hai biến mật khẩu này (`prisma/seed.ts`). Hai giá trị trên chỉ là mẫu cho database đo, có thể đổi. Lệnh seed trong `README.md` ở thư mục gốc chưa có hai biến; khi README gốc được cập nhật thì làm theo README gốc.

3. Đo và ghi kết quả:

   ```bash
   node tests/perf/do-p95.mjs --out docs/minh-chung-p95/ket-qua-docker-compose.md
   ```

   Lệnh trả mã 0 khi cả 4 API đạt với đúng 100 lần gọi, 1 khi có API không đạt hoặc chạy thử với `--lan` khác 100, 2 khi không chuẩn bị được (API chưa chạy, chưa seed, hết hàng).

4. Dọn project đo và bật lại project dev:

   ```bash
   docker compose -p brewlite-p95 down -v
   docker compose up -d
   ```

   `up -d` dùng lại volume database của project dev nên dữ liệu dev còn nguyên.

## Script đo thế nào

| Mục | Cách làm | Nguồn |
|---|---|---|
| 4 API | `GET /products`, `GET /products/:id`, `POST /orders/checkout`, `POST /orders/{id}/payments`, gọi thẳng BrewLite API ở cổng 3001 | NFR-01 |
| 100 lần liên tiếp | Mỗi API 100 lần, gọi xong lần trước mới gửi lần sau; không có lượt khởi động bỏ qua | NFR-01 |
| Thời gian | Từ lúc gửi request tới lúc đọc hết body, đo ở máy gọi | **[Đề xuất]** |
| p95 | Nearest-rank: giá trị thứ ceil(0,95 × 100) = 95 sau khi sắp tăng dần | **[Đề xuất]** |
| Đạt | Một API đạt khi có đủ 100 mẫu, p95 < 500 ms và mọi mẫu có đúng mã HTTP: `200` cho danh sách và chi tiết món, `201` cho tạo đơn, `200` hoặc `202` cho thanh toán. Kết luận chung chỉ "đạt" khi cả 4 API đạt. Chạy với `--lan` khác 100 thì kết quả ghi là chạy thử | NFR-01; **[Đề xuất]** cho phần mã HTTP |
| Đăng nhập | Mỗi lần chạy đăng ký một tài khoản khách mới; các API trên đều cần đăng nhập (FR-01, NFR-02) | SRS |
| Tạo đơn | Mỗi đơn 1 ly, size đầu tiên nếu món có size, chia vào các món còn nhiều hàng nhất để không hết hàng giữa chừng | **[Đề xuất]** |
| Thanh toán | Ví, khóa mới cho mỗi đơn vừa tạo. Kịch bản do server chọn (FR-07), nên có cả thành công, thất bại và đang xử lý (`202`) | FR-07, FR-15 |

Tạo đơn và thanh toán làm giảm tồn kho. Một database seed mới đủ cho khoảng hai lần chạy; sau đó script dừng và báo hết hàng, khi đó chạy lại từ bước 1 (chỉ xóa database của project đo).

## Kết quả

| Lần đo | Người đo | Môi trường | Kết quả |
|---|---|---|---|
| [`docs/nfr01-results.json`](../nfr01-results.json), 15/11/2026 (PR #66) | Tâm | Docker Compose, dữ liệu seed, bản ghép PR #58 và #59 (chưa có lịch sử, hủy đơn, API nhân viên) | 4/4 API đạt; p95: `GET /products` 4,7 ms, `GET /products/:id` 5,8 ms, tạo đơn 16,9 ms, thanh toán 19,1 ms (8 lần `202`) |
| [Docker Compose](ket-qua-docker-compose.md), 15/11/2026 (PR #67) | Duy | Project Compose riêng `brewlite-p95` từ database trống, dữ liệu seed, `main` commit `e446383` (đã có các API của Task 5), đo bằng `tests/perf/do-p95.mjs` theo các bước ở trên | 4/4 API đạt (đủ 100 mẫu, đúng mã HTTP); p95: 4,2 ms, 5,0 ms, 13,5 ms, 17,0 ms (10 lần `202`) |
| [Chạy thử ngoài Docker](chay-thu-ngoai-docker.md), 15/11/2026 | Duy | API chạy bằng `node`, PostgreSQL trên máy; **chưa đạt điều kiện "chạy bằng docker-compose"** | 4/4 API đạt; chỉ để kiểm tra script |

Hai lần đo bằng Docker Compose đều đạt NFR-01. Lần đo của Tâm (PR #66) có đủ 400 mẫu trong file JSON. Lần đo của Duy (PR #67) bổ sung script chạy lại được và đo trên mã nguồn mới hơn; số mili giây giữa hai lần khác nhau vì đo ở hai thời điểm trên hai bản mã nguồn khác nhau; cả hai đều cách xa ngưỡng 500 ms. Khi kiểm lại sau này, chạy script theo mục "Cách đo" ở trên.
