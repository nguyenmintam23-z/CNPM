# Hợp đồng API – Xác thực và health check (Task 5)

Nguồn: đề 7.1 (đăng ký, đăng nhập, JWT), 7.2 (health endpoint); SRS FR-01, FR-12, FR-17, FR-20, FR-21, NFR-02, NFR-03, NFR-07; ADR-001; `backend-data-design.md` §3; `frontend-architecture.md` §7.

Đường dẫn dưới đây là của BrewLite API. Trình duyệt gọi qua proxy cùng origin của BrewLite Web: `/api/auth/login` → `/auth/login`. Proxy phải **chuyển tiếp `Cookie` của request và trả lại `Set-Cookie` của response** (frontend-architecture §7).

## 1. Phiên đăng nhập

- JWT nằm trong cookie `brewlite_session`: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1800` (30 phút, không refresh token).
- JWT **không** có trong body. Frontend không đọc được JWT, chỉ biết người dùng qua `GET /auth/me`.
- Mọi API đều cần đăng nhập, trừ `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /health`. Từ Task 5, `GET /products` và `GET /products/:id` cũng cần đăng nhập (FR-01, bỏ giới hạn Sprint 1).
- Thiếu cookie, JWT hết hạn, sai chữ ký hoặc đã đăng xuất → `401`. Đúng phiên nhưng sai vai trò → `403`.
- Vai trò: `CUSTOMER`, `STAFF`, `MANAGER`. Đăng ký luôn tạo `CUSTOMER`.

## 2. Endpoint

| Method, đường dẫn | Body | Thành công | Lỗi |
|---|---|---|---|
| `POST /auth/register` | `{ email, password, fullName }` | `201` `{ user, role }`, **không** đặt cookie | `400` dữ liệu sai; `409` email đã đăng ký |
| `POST /auth/login` | `{ email, password }` | `200` `{ user, role }` + `Set-Cookie` | `400` dữ liệu sai; `401` sai email hoặc mật khẩu |
| `GET /auth/me` | | `200` `{ user, role }` | `401` |
| `POST /auth/logout` | | `204`, xóa cookie, JWT cũ bị `401` từ đó | Không có lỗi: chưa đăng nhập vẫn `204` |
| `GET /health` | | `200` `{ "status": "ok" }` | `503` `{ "status": "error" }` khi không truy cập được PostgreSQL |

`user` = `{ id, email, fullName }`. Không bao giờ trả mật khẩu hay mật khẩu đã băm.

## 3. Kiểm tra dữ liệu (NFR-04)

| Trường | Quy tắc | Thông báo |
|---|---|---|
| `email` | đúng định dạng, tối đa 254 ký tự; bỏ khoảng trắng hai đầu, so sánh không phân biệt hoa thường | `Email không hợp lệ` |
| `password` | 8–72 ký tự | `Mật khẩu tối thiểu 8 ký tự` / `Mật khẩu tối đa 72 ký tự` |
| `fullName` | không rỗng, tối đa 100 ký tự | `Họ tên không được để trống` |
| Trường lạ (ví dụ `role`) | bị từ chối | `property role should not exist` |

Lỗi dùng dạng mặc định của NestJS, như hợp đồng Sprint 1:

```json
{ "statusCode": 400, "message": ["Email không hợp lệ", "Mật khẩu tối thiểu 8 ký tự"], "error": "Bad Request" }
{ "statusCode": 401, "message": "Email hoặc mật khẩu không đúng", "error": "Unauthorized" }
{ "statusCode": 401, "message": "Chưa đăng nhập hoặc phiên đã hết hạn", "error": "Unauthorized" }
{ "statusCode": 409, "message": "Email đã được đăng ký", "error": "Conflict" }
```

Sai email hay sai mật khẩu đều trả cùng một thông báo, để không lộ email nào đã có tài khoản.

## 4. Gợi ý cho BrewLite Web

- Gặp `401` ở bất kỳ API nào: giữ giỏ hàng, chuyển tới trang đăng nhập, đăng nhập xong quay lại trang đang làm (FR-12).
- Sau khi đăng ký thành công thì chuyển sang trang đăng nhập; API không tự đăng nhập.
- Đăng xuất: gọi `POST /api/auth/logout`, xóa trạng thái phiên ở client, chuyển tới trang đăng nhập (FR-21).
- Cookie có `Secure`. Chrome và Firefox chấp nhận cookie `Secure` trên `http://localhost`. Nếu trình duyệt khác không nhận, đặt `COOKIE_SECURE=false` cho API **chỉ ở local**.
