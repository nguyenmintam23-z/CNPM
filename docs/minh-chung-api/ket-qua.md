# Kết quả chạy các luồng API

- Thời điểm: 2026-11-15T08:09:39.474Z
- API: http://localhost:3001
- Script: `tests/smoke/minh-chung-api.mjs`. Giá trị cookie JWT đã che; mật khẩu không ghi ra.

| # | Nhóm | Bước | Yêu cầu | Mong đợi | Thực tế | Ghi nhận | Đạt |
|---|---|---|---|---|---|---|---|
| 1 | Health | API và PostgreSQL sẵn sàng | `GET /health` | 200 | 200 | {"status":"ok"} | Đạt |
| 2 | Xác thực | Chưa đăng nhập không xem được menu (FR-01, NFR-02) | `GET /products` | 401 | 401 | Chưa đăng nhập hoặc phiên đã hết hạn | Đạt |
| 3 | Xác thực | Đăng ký tài khoản khách (FR-20) | `POST /auth/register` | 201 | 201 | role=CUSTOMER; không đặt cookie: true; không trả mật khẩu: true | Đạt |
| 4 | Xác thực | Sai mật khẩu bị từ chối (FR-21) | `POST /auth/login` | 401 | 401 | Email hoặc mật khẩu không đúng | Đạt |
| 5 | Xác thực | Đăng nhập, JWT trong cookie HttpOnly (ADR-001) | `POST /auth/login` | 200 | 200 | Set-Cookie: brewlite_session=<đã che>; Max-Age=1800; Path=/; Expires=Sun, 15 Nov 2026 08:39:33 GMT; HttpOnly; SameSite=Lax; body không có token: true | Đạt |
| 6 | Xác thực | Đọc phiên hiện tại | `GET /auth/me` | 200 | 200 | role=CUSTOMER, email=(đúng tài khoản vừa tạo) | Đạt |
| 7 | Menu | Danh sách món, có món hết hàng (FR-01) | `GET /products` | 200 | 200 | 5 món; Trà đào cam sả có availableQuantity = 0 | Đạt |
| 8 | Menu | Chi tiết món, size và topping (FR-02, FR-03) | `GET /products/:id` | 200 | 200 | Trà sữa trân châu: 2 size, 3 topping | Đạt |
| 9 | Tạo đơn | Tạo đơn, giá tính ở server (FR-06) | `POST /orders/checkout` | 201 | 201 | BL-261115-4ERGR: PENDING_PAYMENT/HELD, tổng 94000 đ | Đạt |
| 10 | Tạo đơn | Gửi lại cùng requestId → trả đơn cũ, không tạo trùng (FR-18) | `POST /orders/checkout` | 200 | 200 | cùng mã đơn: true | Đạt |
| 11 | Tạo đơn | Client gửi giá/tổng tiền → từ chối (FR-06, NFR-04) | `POST /orders/checkout` | 400 | 400 | ["items.0.property totalAmount should not exist"] | Đạt |
| 12 | Tạo đơn | Món hết hàng → 409 kèm món thiếu (FR-13, UC-01 E2) | `POST /orders/checkout` | 409 | 409 | Trà đào cam sả đã hết hàng | Đạt |
| 13 | Thanh toán | Thẻ mô phỏng thất bại → FAILED kèm lý do, đơn vẫn chờ (FR-14) | `POST /orders/{id}/payments` | 200 | 200 | FAILED: Thẻ mô phỏng bị từ chối. Vui lòng thử lại.; đơn PENDING_PAYMENT/RELEASED | Đạt |
| 14 | Thanh toán | Thử lại bằng khóa mới, Ví thành công → đơn CONFIRMED (FR-07) | `POST /orders/{id}/payments` | 200 | 200 | SUCCEEDED; đơn BL-261115-4ERGR CONFIRMED/COMMITTED | Đạt |
| 15 | Thanh toán | Gửi lại cùng khóa → cùng kết quả, không trừ tiền lần hai (FR-15) | `POST /orders/{id}/payments` | 200 | 200 | cùng Payment: true | Đạt |
| 16 | Thanh toán | Phản hồi chậm → 202 PROCESSING (UC-01 E6) | `POST /orders/{id}/payments` | 202 | 202 | PROCESSING | Đạt |
| 17 | Thanh toán | Gửi lại cùng khóa sau khi chờ → có kết quả cuối | `POST /orders/{id}/payments` | 200 | 200 | SUCCEEDED; đơn CONFIRMED | Đạt |
| 18 | Đơn của khách | Lịch sử đơn của mình, mới nhất trước (FR-08) | `GET /orders` | 200 | 200 | 3 đơn; đầu danh sách: BL-261115-SKQNJ | Đạt |
| 19 | Đơn của khách | Chi tiết đơn (FR-08) | `GET /orders/:id` | 200 | 200 | BL-261115-4ERGR CONFIRMED, 1 dòng | Đạt |
| 20 | Đơn của khách | Hủy đơn chờ thanh toán, trả tồn (FR-23) | `POST /orders/:id/cancel` | 200 | 200 | CANCELLED/RELEASED | Đạt |
| 21 | Đơn của khách | Thanh toán đơn đã hủy → từ chối (FR-24) | `POST /orders/{id}/payments` | 409 | 409 | ORDER_NOT_PAYABLE | Đạt |
| 22 | Đơn của khách | Hủy đơn đã xác nhận → từ chối (FR-23) | `POST /orders/:id/cancel` | 409 | 409 | ORDER_NOT_CANCELLABLE | Đạt |
| 23 | Nhân viên | Khách gọi API nhân viên → 403 (FR-17) | `GET /staff/orders` | 403 | 403 | Không có quyền thực hiện thao tác này | Đạt |
| 24 | Nhân viên | Nhân viên đăng nhập (tài khoản seed) | `POST /auth/login` | 200 | 200 | Set-Cookie: brewlite_session=<đã che>; Max-Age=1800; Path=/; Expires=Sun, 15 Nov 2026 08:39:39 GMT; HttpOnly; SameSite=Lax | Đạt |
| 25 | Nhân viên | Hàng chờ chỉ có đơn đã thanh toán (FR-09) | `GET /staff/orders` | 200 | 200 | 2 đơn; có BL-261115-4ERGR: true; có đơn đã hủy: false | Đạt |
| 26 | Nhân viên | Bỏ bước → 400 (FR-10) | `PATCH /staff/orders/:id/status` | 400 | 400 | INVALID_TRANSITION | Đạt |
| 27 | Nhân viên | CONFIRMED → PREPARING (FR-10) | `PATCH /staff/orders/:id/status` | 200 | 200 | PREPARING | Đạt |
| 28 | Nhân viên | PREPARING → READY (FR-10) | `PATCH /staff/orders/:id/status` | 200 | 200 | READY | Đạt |
| 29 | Nhân viên | READY → COMPLETED (FR-10) | `PATCH /staff/orders/:id/status` | 200 | 200 | COMPLETED | Đạt |
| 30 | Nhân viên | Gửi trạng thái cũ (đơn còn CONFIRMED) → 409 kèm trạng thái mới nhất (FR-17) | `PATCH /staff/orders/:id/status` | 409 | 409 | ORDER_STATUS_CHANGED; order.status=CONFIRMED | Đạt |
| 31 | Nhân viên | Khách mở lại đơn thấy trạng thái mới (FR-08) | `GET /orders/:id` | 200 | 200 | COMPLETED | Đạt |
| 32 | Quản lý | Quản lý đăng nhập (tài khoản seed) | `POST /auth/login` | 200 | 200 | Set-Cookie: brewlite_session=<đã che>; Max-Age=1800; Path=/; Expires=Sun, 15 Nov 2026 08:39:39 GMT; HttpOnly; SameSite=Lax | Đạt |
| 33 | Quản lý | Lọc đơn đã hủy (FR-11) | `GET /manager/orders?status=CANCELLED` | 200 | 200 | 1 đơn, tất cả CANCELLED: true | Đạt |
| 34 | Quản lý | Chi tiết đơn có lần thanh toán thất bại (FR-11) | `GET /manager/orders/:id` | 200 | 200 | CARD FAILED (Thẻ mô phỏng bị từ chối. Vui lòng thử lại.) → WALLET SUCCEEDED | Đạt |
| 35 | Quản lý | Quản lý không cập nhật tiến độ → 403 | `PATCH /staff/orders/:id/status` | 403 | 403 | Không có quyền thực hiện thao tác này | Đạt |
| 36 | Xác thực | Đăng xuất (FR-21) | `POST /auth/logout` | 204 | 204 | Set-Cookie: brewlite_session=<đã che>; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax | Đạt |
| 37 | Xác thực | JWT cũ sau đăng xuất bị từ chối (ADR-001) | `GET /auth/me` | 401 | 401 | Chưa đăng nhập hoặc phiên đã hết hạn | Đạt |

**Tổng:** 37/37 bước đạt.
