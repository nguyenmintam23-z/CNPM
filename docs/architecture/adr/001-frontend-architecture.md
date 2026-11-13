# BREWLITE – ADR-001: KIẾN TRÚC FRONTEND NEXT.JS/PWA VÀ XÁC THỰC JWT
## 1. Bối cảnh

BrewLite sử dụng Next.js/PWA để cung cấp menu, tùy chọn sản phẩm, giỏ hàng, checkout, thanh toán mô phỏng và lịch sử/trạng thái đơn, đồng thời cung cấp giao diện theo quyền cho nhân viên và quản lý. Frontend kết nối tới NestJS; dữ liệu PostgreSQL và xử lý thanh toán thuộc backend. Các yêu cầu đã chốt của Task 1–2 bao gồm đăng nhập trước khi xem menu, giữ giỏ hàng khi JWT hết hạn (FR-12), xác thực vai trò (NFR-02), chống gửi trùng khi tạo đơn và thanh toán (FR-15, FR-18), đăng xuất làm mất hiệu lực phiên (FR-21).

Trên Render, **BrewLite Web** và **BrewLite API** chạy ở hai service với các tên miền `*.onrender.com` khác site. Trình duyệt gọi trực tiếp tên miền API sẽ khiến cookie xác thực do API thiết lập có thể bị xem là cookie bên thứ ba và bị hạn chế trên Safari/iPhone. Kiến trúc xác thực cần vận hành đồng nhất trên các trình duyệt và không đưa JWT cho JavaScript phía client.

## 2. Quyết định

### 2.1. Kiến trúc frontend

- Sử dụng **BrewLite Web (Next.js/PWA)** trong `apps/web/` theo hướng mobile-first và tổ chức theo feature: Auth, Catalog, Cart, Checkout, Payment UI, Orders, Operations UI và API Client.
- Dùng **C4 Level 3** để mô tả các component của BrewLite Web.
- API Client truy cập BrewLite API thông qua proxy `/api/*` của Next.js. Next.js server chuyển tiếp request tới backend bằng HTTPS. Trình duyệt không gọi trực tiếp tên miền BrewLite API.
- BrewLite Web không truy cập trực tiếp PostgreSQL hoặc `PaymentService`; `PaymentService` là service nội bộ thuộc `PaymentModule` của NestJS.

### 2.2. Cơ chế lưu và truyền JWT

- API phát hành JWT có claim jti sau đăng nhập hợp lệ và đặt cookie **`HttpOnly; Secure; SameSite=Lax; Path=/`**. JWT có hiệu lực **30 phút**; MVP **không dùng refresh token**.
- Trình duyệt gọi `POST /api/auth/login`; Next.js chuyển tiếp tới `POST /auth/login` của BrewLite API. API trả `Set-Cookie` chứa JWT; **body chỉ trả `user` và `role`, không trả JWT**. Proxy chuyển tiếp `Set-Cookie` về trình duyệt để cookie gắn với origin BrewLite Web.
- Trình duyệt tự gửi cookie cho các request `/api/*` cùng origin. Next.js chuyển tiếp header `Cookie` đến BrewLite API. Guard của `AuthModule` đọc JWT từ cookie, xác thực người dùng, vai trò và quyền sở hữu dữ liệu; trả `401` khi chưa xác thực hoặc token bị thu hồi, `403` khi không đủ quyền.
- Frontend gọi `GET /api/auth/me` để nhận user/role từ endpoint backend `GET /auth/me`, không đọc token bằng JavaScript.
- Khi JWT hết hạn, backend trả `401`; frontend **giữ giỏ hàng**, chuyển đến đăng nhập và khôi phục luồng sau khi đăng nhập lại (FR-12, UC-01 A1).
- Đăng xuất bằng `POST /api/auth/logout` (backend `POST /auth/logout`). Backend xóa cookie và lưu jti vào danh sách thu hồi đến thời điểm hết hạn; token cũ bị từ chối với `401` (FR-21).

### 2.3. Bảo vệ request và dữ liệu

- Cookie sử dụng `SameSite=Lax`. Các request thay đổi dữ liệu chỉ thực hiện qua `POST` hoặc `PATCH` với payload JSON; `GET` không gây thay đổi trạng thái dữ liệu.
- Proxy bảo toàn HTTP method, body, status và các header cần thiết, đặc biệt `Cookie`/`Set-Cookie`. Dữ liệu token không được ghi vào log hoặc đưa vào JS bundle.
- Tầng backend thực hiện validation, phân quyền, transaction và idempotency; frontend chỉ thể hiện kết quả chính thức. Khi triển khai, bảo vệ CSRF được kiểm thử và bổ sung kiểm tra `Origin` hoặc CSRF token nếu cần, vì chỉ dùng `SameSite=Lax` và JSON không thể được xem là bảo vệ đầy đủ trong mọi tình huống.

## 3. Lựa chọn khác

| Phương án | Lý do không chọn |
|---|---|
| Trình duyệt gọi trực tiếp domain BrewLite API và nhận cookie từ API | Phụ thuộc chính sách chặn cookie bên thứ ba khi hai service Render khác site, đặc biệt trên Safari/iPhone. |
| Gửi JWT trong JSON body và lưu trong `localStorage` để gửi `Authorization: Bearer` | JavaScript có thể đọc JWT; tăng rủi ro lộ token khi xảy ra XSS và phải quản lý thủ công vòng đời token. |
| Lưu JWT trong cookie HttpOnly và chỉ gọi API qua proxy Next.js | **Phương án được chọn**: cùng origin với frontend, tránh cookie bên thứ ba, tách token khỏi mã JavaScript phía trình duyệt. |

Kiến trúc frontend theo feature được ưu tiên so với việc phân nhóm file chỉ theo lớp kỹ thuật vì cho phép truy vết trực tiếp các FR và chia công việc theo Sprint. API Client tập trung được chọn để tránh lặp lại xử lý lỗi/phiên trong từng màn hình.

## 4. Hệ quả

**Ưu điểm:** Người dùng đăng nhập và truy cập API qua cùng origin của BrewLite Web; JWT không phải xuất hiện trong JSON response hoặc bộ nhớ JavaScript; kiểm tra vai trò do NestJS đảm nhiệm. Quy tắc giữ giỏ khi `401` và thu hồi token khi đăng xuất đáp ứng FR-12, FR-21.

**Hạn chế và đánh đổi:** Tăng trách nhiệm của Next.js proxy và yêu cầu chuyển tiếp chính xác cookie, status, method/body. Cookie hết hạn sau 30 phút khiến người dùng cần đăng nhập lại; không có refresh token trong MVP. `SameSite=Lax` là một lớp giảm rủi ro CSRF nhưng không thay thế việc kiểm tra an toàn request khi triển khai. `AuthModule`, cấu hình Render/HTTPS và Deployment Diagram phải đồng bộ với luồng proxy cùng origin.

**Phạm vi áp dụng:** Quyết định áp dụng cho `apps/web/`, `AuthModule` trong `apps/api/`, tất cả request `/api/*` của trình duyệt và tài liệu triển khai production. Các thao tác nghiệp vụ đặt đơn/thanh toán tiếp tục sử dụng `requestId` và `idempotencyKey` theo SRS và Sequence Checkout; xác thực cookie không thay đổi các quy tắc này.
