# Minh chứng chạy BrewLite API

**Yêu cầu:** Phân công Task 5, phần Duy (Backend), sản phẩm bàn giao: "Unit test, ảnh/log chạy API, health endpoint hoạt động". Đề 7.2: `GET /health`, log.

Minh chứng gồm hai phần, đều lấy từ một lần chạy BrewLite API bằng Docker Compose với dữ liệu seed:

| File | Nội dung |
|---|---|
| [`ket-qua.md`](ket-qua.md) | 37 bước gọi API theo các luồng chính, mỗi bước có mã HTTP mong đợi, mã thực tế và phần kết quả đáng xem. Một bước chỉ "Đạt" khi đúng mã HTTP **và** đúng điều kiện nghiệp vụ ghi trong tên bước (ví dụ tổng tiền khớp giá menu, trạng thái đơn và tồn, danh sách lọc có đúng đơn). Sinh tự động bằng [`tests/smoke/minh-chung-api.mjs`](../../tests/smoke/minh-chung-api.mjs). |
| [`log-api.jsonl`](log-api.jsonl) | Log JSON của container `api` trong lần chạy đó (chỉ các dòng sự kiện), kể cả `health_db_unavailable` khi tắt database. |

Unit test, e2e và integration test chạy trong CI (`.github/workflows/ci.yml`); hiệu năng xem [`docs/minh-chung-p95`](../minh-chung-p95/README.md).

## Kết quả lần chạy 15/11/2026

`main` commit `f35e945`, Docker Desktop 4.99 (Engine 29.9.3, Compose 5.7.0), PostgreSQL 16.16, Node 22 trong container. **37/37 bước đạt.**

| Nhóm | Đã chạy | Yêu cầu |
|---|---|---|
| Health | `GET /health` → `200 {"status":"ok"}`; tắt container `db` → `503 {"status":"error"}` và log `health_db_unavailable`; bật lại → `200` | Đề 7.2, NFR-07, ADR-003 |
| Xác thực | Chưa đăng nhập xem menu → `401`; đăng ký `201` (không đặt cookie, không trả mật khẩu); sai mật khẩu `401`; đăng nhập đặt cookie `HttpOnly; SameSite=Lax; Max-Age=1800`, body không có token; đăng xuất `204`, JWT cũ bị `401` | FR-01, FR-20, FR-21, NFR-02, ADR-001 |
| Menu | Danh sách có món hết hàng; chi tiết có size, topping | FR-01..FR-03 |
| Tạo đơn | Tạo đơn `201`, `PENDING_PAYMENT`/`HELD`, tổng tiền khớp giá menu (94.000 đ cho 2 ly Trà sữa size M + trân châu); gửi lại cùng `requestId` → `200` cùng đơn; gửi `totalAmount` từ client → `400`; món hết hàng → `409` kèm đúng món thiếu | FR-06, FR-13, FR-18 |
| Thanh toán | Thẻ thất bại kèm lý do, đơn vẫn chờ; thử lại khóa mới, Ví thành công → `CONFIRMED`/`COMMITTED`; gửi lại cùng khóa → cùng Payment; phản hồi chậm `202` rồi có kết quả cuối | FR-07, FR-14, FR-15, UC-01 E6 |
| Đơn của khách | Lịch sử đúng 3 đơn của khách, mới nhất trước; chi tiết; hủy đơn chờ thanh toán → `CANCELLED`/`RELEASED`, số còn bán của món trả lại đúng 1 ly; thanh toán đơn đã hủy, hủy đơn đã xác nhận → `409` | FR-08, FR-23, FR-24 |
| Nhân viên | Khách gọi → `403`; hàng chờ chỉ có đơn đã thanh toán; bỏ bước `400`; đi đủ `PREPARING → READY → COMPLETED`; gửi trạng thái cũ → `409` kèm trạng thái mới nhất; khách thấy `COMPLETED` | FR-09, FR-10, FR-17 |
| Quản lý | Lọc đơn đã hủy; chi tiết đơn thấy lần Thẻ thất bại rồi Ví thành công; quản lý cập nhật tiến độ → `403` | FR-11 |

Cookie trong lần chạy này **không có cờ `Secure`**, vì `docker-compose.yml` đặt `COOKIE_SECURE: "false"` để chạy trên `http://localhost`. Ở production qua HTTPS, cookie có `Secure` (ADR-001, `api-auth.md`).

Log có 11 loại sự kiện: `user_registered`, `login_succeeded`, `login_failed`, `logout`, `order_created`, `order_cancelled`, `payment_created`, `payment_result_pending`, `payment_result_applied`, `order_status_updated`, `health_db_unavailable`. Log chỉ ghi id, mã đơn, trạng thái; không có email, mật khẩu, JWT hay khóa thanh toán.

## Chạy lại

Thử script có bắt được lỗi: chạy với `SEED_STAFF_PASSWORD` sai thì các bước nhân viên ghi **Sai** và script trả mã 1 (đã thử ngày 15/11/2026).

Giống cách đo p95 ([`docs/minh-chung-p95/README.md`](../minh-chung-p95/README.md)), dùng project Compose riêng để không đụng database dev:

```bash
docker compose stop
docker compose -p brewlite-mc down -v
docker compose -p brewlite-mc up --build -d
docker compose -p brewlite-mc exec -e SEED_STAFF_PASSWORD='Staff@12345' -e SEED_MANAGER_PASSWORD='Manager@12345' api npx prisma db seed
SEED_STAFF_PASSWORD='Staff@12345' SEED_MANAGER_PASSWORD='Manager@12345' node tests/smoke/minh-chung-api.mjs --out docs/minh-chung-api/ket-qua.md
```

PowerShell: đặt biến bằng `$env:SEED_STAFF_PASSWORD='Staff@12345'; $env:SEED_MANAGER_PASSWORD='Manager@12345'` rồi chạy lệnh `node`. Script trả mã 0 khi mọi bước đạt.

Thử health khi mất database, rồi lưu log:

```bash
docker compose -p brewlite-mc stop db
curl -i http://localhost:3001/health        # 503
docker compose -p brewlite-mc start db
docker compose -p brewlite-mc logs api --no-log-prefix | grep '"event"' > docs/minh-chung-api/log-api.jsonl
```

Dọn và bật lại dev:

```bash
docker compose -p brewlite-mc down -v
docker compose up -d
```
