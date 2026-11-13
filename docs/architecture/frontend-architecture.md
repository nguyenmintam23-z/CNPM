# BREWLITE – KIẾN TRÚC FRONTEND
## 1. Mục đích và phạm vi
Tài liệu xác định kiến trúc của **BrewLite Web** trong hệ thống BrewLite, tập trung vào các component, trách nhiệm, quan hệ với API, quản lý phiên đăng nhập, trạng thái giao diện và xử lý ngoại lệ. Thiết kế phục vụ việc hiện thực Sprint 1 và Sprint 2, đồng thời bảo đảm khả năng truy vết từ yêu cầu và sơ đồ nghiệp vụ đã được nhóm phê duyệt.

Căn cứ thiết kế gồm `context-and-scope.md`, `srs.md`, `use-case-checkout.md` thuộc Task 1 và các sơ đồ Activity, Sequence Checkout, Class Domain thuộc Task 2. Các quy tắc nghiệp vụ được giữ nguyên theo SRS và UC-01; frontend không thay thế trách nhiệm xác thực, transaction, quản lý tồn kho hoặc xác nhận thanh toán của backend.

## 2. Vị trí trong kiến trúc C4

Nhóm áp dụng mô hình **C4** để mô tả kiến trúc hệ thống. Theo thiết kế backend/data và thanh toán – vận hành đã thống nhất, các container triển khai chính gồm:

| Container | Công nghệ | Trách nhiệm |
|---|---|---|
| **BrewLite Web** | Next.js/PWA | Hiển thị giao diện, tiếp nhận thao tác, quản lý trạng thái phía người dùng và gọi API. |
| **BrewLite API** | NestJS | Xác thực JWT, phân quyền, kiểm tra dữ liệu, xử lý nghiệp vụ và điều phối thanh toán mô phỏng. |
| **BrewLite Database** | PostgreSQL | Lưu dữ liệu tài khoản, sản phẩm, đơn hàng, thanh toán và tồn kho. |

**PaymentService** là service nội bộ thuộc **PaymentModule** trong BrewLite API, hoạt động trong cùng tiến trình backend; đây **không phải container hoặc dịch vụ triển khai riêng**. BrewLite Web giao tiếp với BrewLite API qua proxy `/api/*` của Next.js; kết nối giữa các dịch vụ production sử dụng HTTPS. Trình duyệt không gọi trực tiếp domain BrewLite API và không truy cập PaymentService hay PostgreSQL.

BrewLite API kết nối PostgreSQL qua Prisma và cấu hình **`DATABASE_URL`** ở môi trường backend; biến này không xuất hiện trong mã nguồn client. Nhóm sử dụng **Prisma Migrate** và chạy **seed độc lập**, không tự động chạy lại mỗi lần deploy.

Tài liệu tập trung mô tả **C4 Level 3 – Component** của BrewLite Web; sơ đồ Level 1 và Level 2 thuộc tài liệu kiến trúc tổng thể của nhóm.

## 3. Kiến trúc component của BrewLite Web

Các component được chia theo chức năng nghiệp vụ. Tầng giao diện tiếp nhận thao tác; **API Client** tập trung giao tiếp với NestJS; mọi dữ liệu nghiệp vụ chính thức được xác nhận tại backend.

| Component | Chức năng và trách nhiệm | Yêu cầu liên quan |
|---|---|---|
| **Auth** | Đăng ký, đăng nhập, đăng xuất; duy trì trạng thái phiên và bảo vệ truy cập theo vai trò. | FR-01, FR-12, FR-20, FR-21 |
| **Catalog** | Hiển thị menu, chi tiết đồ uống, size/topping hợp lệ và tình trạng hết hàng. | FR-01–FR-03 |
| **Cart** | Thêm, chỉnh sửa, xóa dòng món; lưu size/topping, số lượng và tính tổng tiền tạm tính. | FR-04, FR-05, FR-19 |
| **Checkout** | Hiển thị thông tin đặt hàng, kiểm tra dữ liệu phía client và gửi yêu cầu tạo đơn. | FR-06, FR-13, FR-16, FR-18, FR-22 |
| **Payment UI** | Chọn Ví/Thẻ mô phỏng; hiển thị kết quả, trạng thái đang xử lý và hỗ trợ thử lại. | FR-07, FR-14, FR-15 |
| **Orders** | Hiển thị lịch sử, chi tiết, trạng thái và yêu cầu hủy đơn đủ điều kiện. | FR-08, FR-23, FR-24 |
| **Operations UI** | Giao diện theo quyền của nhân viên quầy và quản lý; xem, xử lý hoặc tra cứu đơn theo SRS. | FR-09–FR-11, FR-17 |
| **API Client** | Thống nhất cách gửi request, nhận response, gọi `/api/*` cùng origin, gửi cookie tự động và xử lý lỗi HTTP. | FR-12–FR-18, NFR-02, NFR-04 |

Luồng sử dụng chính của khách hàng là **Auth → Catalog → Cart → Checkout → Payment UI → Orders**. Đây là trình tự chức năng, không phải chuỗi gọi trực tiếp bắt buộc giữa các component. Catalog, Auth, Checkout, Payment UI, Orders và Operations UI truy cập nghiệp vụ backend thông qua API Client và proxy Next.js. Cart quản lý các lựa chọn phía client; backend kiểm tra lại mọi dữ liệu khi tạo đơn.

**Sơ đồ C4 Level 3** có file nguồn `docs/architecture/frontend-components.puml`; bản SVG kết xuất tương ứng được lưu tại `docs/architecture/frontend-components.svg`. Sơ đồ phải thể hiện cả Operations UI để bao phủ các yêu cầu dành cho nhân viên/quản lý, ngoài luồng khách hàng.

## 4. Tổ chức mã nguồn frontend

Mã nguồn frontend thuộc thư mục `apps/web/` theo cấu trúc repository của Assignment 2. Cấu trúc thiết kế sử dụng các nhóm chức năng tương ứng với C4 Component:

```text
apps/web/
├── public/                 # Manifest, icons, tài nguyên tĩnh
└── src/
    ├── app/                # Routes và layouts
    ├── components/         # UI dùng chung
    ├── features/
    │   ├── auth/
    │   ├── catalog/
    │   ├── cart/
    │   ├── checkout/
    │   ├── payment/
    │   ├── orders/
    │   └── operations/
    ├── lib/api/            # API Client, gọi đường dẫn cùng origin /api/*
    └── types/              # Kiểu dữ liệu trao đổi với API
```

Cách tổ chức theo chức năng tách giao diện khỏi xử lý HTTP, hỗ trợ phát triển và kiểm thử theo từng nghiệp vụ. Next.js đảm nhiệm chuyển tiếp các request `/api/*` sang BrewLite API; cơ chế proxy có thể cấu hình qua rewrite hoặc handler phía server, không làm thay đổi ranh giới module frontend. Tên route cụ thể và thư viện quản lý state sẽ được xác định trong quá trình hiện thực mà không làm thay đổi ranh giới component nêu trên.

BrewLite Web được thiết kế **mobile-first/PWA**. Giao diện phải sử dụng được ở chiều rộng **375 px, không cuộn ngang**, với trạng thái **loading**, **empty** và **error** theo NFR-05. PWA sử dụng manifest và tài nguyên giao diện phù hợp; dữ liệu giá, tồn kho, quyền truy cập và trạng thái thanh toán không được xác nhận từ dữ liệu cache cũ. Các thao tác đặt hàng và thanh toán cần kết nối backend.

## 5. Xác thực và phân quyền

### 5.1. Kiến trúc truyền JWT qua Next.js

BrewLite Web và BrewLite API được triển khai thành hai Web Service trên Render với các tên miền `*.onrender.com` khác site. Để tránh phụ thuộc vào cookie bên thứ ba trên trình duyệt Safari/iPhone, ứng dụng sử dụng **proxy cùng origin**: trình duyệt chỉ giao tiếp với BrewLite Web qua `/api/*`; Next.js chuyển tiếp các request đến BrewLite API. Khi API trả về `Set-Cookie`, tầng proxy chuyển tiếp header này tới trình duyệt để cookie được thiết lập trên origin của BrewLite Web. Tương tự, các request tiếp theo mang cookie phải được proxy chuyển tiếp nguyên vẹn tới API. Chỉ có Next.js server liên lạc với domain backend.

JWT được lưu trong **cookie `HttpOnly; Secure; SameSite=Lax; Path=/`** với thời hạn hiệu lực **30 phút**. Cookie không thể đọc trực tiếp bằng JavaScript phía trình duyệt. JWT không được trả trong JSON body, đưa vào `localStorage` hay ghi vào log. Các API được bảo vệ xác thực JWT và vai trò tại `AuthModule` của NestJS; giao diện chỉ hỗ trợ điều hướng và hiển thị theo quyền.

### 5.2. Đăng nhập và truy vấn phiên

1. Người dùng gửi thông tin đăng nhập từ BrewLite Web đến `POST /api/auth/login`; Next.js proxy chuyển đến `POST /auth/login` của BrewLite API.
2. Khi hợp lệ, API phát hành JWT, trả `Set-Cookie` với các thuộc tính đã thống nhất; response body **chỉ chứa thông tin `user` và `role`, không chứa token**.
3. BrewLite Web sử dụng `GET /api/auth/me` (proxy tới `GET /auth/me`) để xác định người dùng và vai trò hiện tại.
4. Trình duyệt gửi cookie tự động cho các request `/api/*` cùng origin; proxy chuyển tiếp cookie đến BrewLite API. Guard của API lấy JWT từ cookie, xác thực vai trò `CUSTOMER`, `STAFF` hoặc `MANAGER` và quyền sở hữu tài nguyên. API trả `401` nếu không được xác thực và `403` nếu không đủ quyền (NFR-02).

Theo FR-01 và FR-21, người chưa đăng nhập không được xem menu. Các chức năng khách hàng, nhân viên và quản lý chỉ hiển thị khi tài khoản có quyền tương ứng; bảo vệ route ở frontend không thay thế phân quyền tại backend.

### 5.3. Hết hạn phiên và bảo toàn giỏ hàng

JWT hết hiệu lực sau **30 phút**, không áp dụng refresh token trong MVP. Khi API trả `401`, BrewLite Web không xóa giỏ hàng đang lưu riêng, yêu cầu đăng nhập lại và điều hướng trở về luồng đang thực hiện sau khi xác thực thành công (FR-12, UC-01/A1). Thông tin đơn hàng và trạng thái thanh toán được tải lại từ API trước khi tiếp tục; không giả định request đã thất bại hoặc đã hoàn tất chỉ vì phiên hết hạn.

### 5.4. Đăng xuất và thu hồi token

BrewLite Web gọi `POST /api/auth/logout` (proxy tới `POST /auth/logout`). BrewLite API xóa cookie và thêm `jti` của JWT hiện tại vào danh sách thu hồi cho đến thời điểm token hết hạn. Guard từ chối token đã thu hồi bằng phản hồi `401`, kể cả khi token chưa đến thời điểm hết hạn. Frontend xóa trạng thái phiên người dùng, chuyển đến trang đăng nhập và không tiếp tục sử dụng dữ liệu của phiên cũ (FR-21).

### 5.5. Kiểm soát CSRF và cấu hình proxy

Cơ chế bảo vệ đã thống nhất gồm `SameSite=Lax`, các thao tác làm thay đổi dữ liệu chỉ sử dụng `POST`/`PATCH` với nội dung JSON; `GET` không làm thay đổi dữ liệu. Proxy bảo toàn method, body, status, `Cookie` và `Set-Cookie` khi chuyển tiếp. Những biện pháp này là cấu hình nền tảng đã thống nhất; khi triển khai cần kiểm thử CSRF thực tế và bổ sung kiểm tra `Origin`/CSRF token nếu cần để bảo vệ các request nhạy cảm. Cấu hình HTTPS và cookie trên local được phân biệt với production mà không làm thay đổi hợp đồng xác thực.

## 6. Trạng thái và dữ liệu giao diện

| Chức năng | Trạng thái cần thể hiện |
|---|---|
| Menu/chi tiết | Đang tải, danh sách trống, tải lỗi, có dữ liệu; nhãn hết hàng và sản phẩm không tồn tại. |
| Giỏ hàng | Giỏ trống/có món; chỉnh số lượng, size, topping; lỗi lựa chọn không hợp lệ. |
| Checkout | Chưa đủ thông tin, đang tạo đơn, tạo đơn thành công, dữ liệu sai, hết hàng hoặc lỗi hệ thống. |
| Thanh toán | Chưa thanh toán, `PROCESSING`, `SUCCEEDED`, `FAILED`; chưa xác định kết quả khi timeout. |
| Đơn hàng | Danh sách trống/có đơn; xem chi tiết, trạng thái mới nhất và `CANCELLED` khi hủy thành công. |
| Nhân viên/quản lý | Danh sách theo quyền; trạng thái cập nhật thành công hoặc từ chối vì dữ liệu đã thay đổi. |

Giá hiển thị tại Cart và Checkout trước khi xác nhận là **tạm tính**. Tổng tiền chính thức được API tính từ dữ liệu hợp lệ tại thời điểm tạo đơn. Frontend không tự thay đổi `OrderStatus`, `PaymentStatus` hoặc `StockHoldStatus`.

Các trạng thái nghiệp vụ áp dụng theo Class Domain và SRS:

- `OrderStatus`: `PENDING_PAYMENT`, `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`.
- `PaymentStatus`: `PROCESSING`, `SUCCEEDED`, `FAILED`.
- `PaymentMethod`: `WALLET`, `CARD`.
- `StockHoldStatus`: `HELD`, `COMMITTED`, `RELEASED` (do backend quản lý).

## 7. Giao tiếp API và luồng đặt – thanh toán

### 7.1. API boundary

Các endpoint backend vẫn giữ nguyên hợp đồng nghiệp vụ; **đường dẫn mà trình duyệt gọi thêm tiền tố `/api`**, sau đó Next.js chuyển tiếp tới BrewLite API. Bảng dưới đây phân biệt hai phía:

| Trình duyệt gọi trên BrewLite Web | Endpoint tại BrewLite API | Mục đích |
|---|---|---|
| `POST /api/auth/login` | `POST /auth/login` | Đăng nhập, nhận cookie JWT; body trả `user`, `role`. |
| `GET /api/auth/me` | `GET /auth/me` | Xác định người dùng và vai trò hiện tại. |
| `POST /api/auth/logout` | `POST /auth/logout` | Xóa cookie và thu hồi JWT. |
| `GET /api/products` | `GET /products` | Lấy danh sách sản phẩm. |
| `GET /api/products/:id` | `GET /products/:id` | Lấy chi tiết sản phẩm. |
| `POST /api/orders/checkout` | `POST /orders/checkout` | Tạo đơn với `requestId` và dữ liệu giỏ. |
| `POST /api/orders/{id}/payments` | `POST /orders/{id}/payments` | Thanh toán với `method` và `idempotencyKey`. |

Các endpoint xác thực `/auth/me`, `/auth/logout` là hợp đồng đã được Phúc và Duy thống nhất bổ sung. Các endpoint đăng ký, lịch sử/chi tiết/hủy đơn và tác nghiệp nhân viên/quản lý được xác định trong hợp đồng API backend khi triển khai. Tầng API Client gọi các đường dẫn `/api/*` cùng origin và không đọc JWT trực tiếp.

### 7.2. Tạo đơn hàng

Khách xác nhận thông tin đơn tại Checkout. Frontend tạo **`requestId`** cho một lần xác nhận và gửi yêu cầu `POST /api/orders/checkout` (được proxy đến `POST /orders/checkout`) kèm dữ liệu giỏ. API xác thực, kiểm tra món, tùy chọn, số lượng và tồn kho; tính tổng tiền; tạo đơn `PENDING_PAYMENT` và giữ tồn trong transaction.

Nếu cùng một lần xác nhận bị gửi lại do mất phản hồi, frontend **dùng lại `requestId` cũ**. Backend bảo đảm chỉ có một đơn và một lần giữ tồn tương ứng (FR-18). Khi lỗi dữ liệu, hết hàng hoặc transaction thất bại, frontend hiển thị mục cần sửa và **giữ giỏ** (FR-13, FR-16).

### 7.3. Thanh toán mô phỏng

Sau khi tạo đơn, người dùng chọn phương thức `WALLET` hoặc `CARD`. Payment UI gửi `POST /api/orders/{id}/payments` qua API Client và proxy Next.js đến `POST /orders/{id}/payments` của BrewLite API. **Payload thanh toán chứa `method` và `idempotencyKey`**; `orderId` được xác định từ đơn đang thanh toán trong đường dẫn request.

Backend lựa chọn kịch bản thanh toán mô phỏng dựa trên **`orderId` và `idempotencyKey`**, đồng thời **từ chối trường chọn kịch bản do client gửi**. `PaymentModule` gọi `PaymentService` nội bộ để xử lý yêu cầu và lưu/trả trạng thái cho frontend. Payment UI chỉ hiển thị kết quả được API xác nhận.

- **Thành công:** Payment chuyển `SUCCEEDED`, Order chuyển `CONFIRMED`; UI hiển thị mã đơn và xác nhận.
- **Thất bại:** Payment chuyển `FAILED`, Order giữ `PENDING_PAYMENT`, tồn đã giữ được giải phóng. Khách có thể thử lại **trên cùng đơn** với **khóa mới**; API kiểm tra và giữ lại tồn trước khi bắt đầu lần thử mới (FR-14).
- **Timeout/mất phản hồi:** UI hiển thị **Đang xử lý** khi chưa xác định kết quả. Việc tra cứu hoặc gửi lại **cùng lần thử** phải sử dụng **cùng `idempotencyKey`**, không tự kết luận thất bại hay tạo lần thanh toán mới (FR-15).

### 7.4. Theo dõi và hủy đơn

Orders lấy lịch sử và trạng thái thực tế từ API. Khách chỉ được yêu cầu hủy đơn của mình khi Order đang `PENDING_PAYMENT` và **không có Payment `PROCESSING`**. API kiểm tra lại điều kiện trước khi xử lý. Nếu hủy thành công, đơn chuyển `CANCELLED`, được hiển thị trong lịch sử/chi tiết và không còn được thanh toán; frontend không tự hoàn trả tồn kho (FR-23, FR-24).

Nhân viên quầy chỉ xử lý đơn đã `CONFIRMED` và cập nhật tuần tự `CONFIRMED → PREPARING → READY → COMPLETED`. Khi quyền hoặc trạng thái không phù hợp, API từ chối và giao diện tải lại trạng thái mới (FR-09, FR-10, FR-17). Chức năng tra cứu của quản lý theo FR-11 có mức ưu tiên **Should**.

## 8. Xử lý ngoại lệ phía frontend

| Trường hợp | Phản hồi của BrewLite Web |
|---|---|
| JWT hết hạn hoặc chưa đăng nhập | API trả `401`; yêu cầu đăng nhập lại qua `/api/auth/login`, giữ giỏ hàng và không dùng refresh token trong MVP. |
| Không đủ quyền hoặc truy cập đơn của người khác | Hiển thị không đủ quyền; không hiển thị dữ liệu bị bảo vệ. |
| Giỏ trống, size/topping hoặc số lượng không hợp lệ | Chỉ rõ dòng cần sửa, không làm mất các lựa chọn hợp lệ khác. |
| Sản phẩm hết hàng/không đủ tồn | Thông báo món và số lượng cần sửa; giữ giỏ. |
| Lỗi tạo đơn hoặc gửi lại yêu cầu | Giữ giỏ; với retry cùng lần xác nhận dùng lại `requestId`. |
| Thanh toán thất bại đã xác định | Thông báo thất bại; cho phép thử lại trên cùng đơn bằng khóa mới. |
| Thanh toán timeout/chưa có kết quả | Giữ trạng thái đang xử lý, xác minh bằng cùng `idempotencyKey`. |
| Hủy đơn hoặc cập nhật trạng thái bị từ chối | Thông báo và tải lại trạng thái mới nhất từ API. |
| Không tải được dữ liệu | Hiển thị trạng thái lỗi và cung cấp thao tác thử lại thích hợp. |

Frontend kiểm tra dữ liệu có thể phát hiện tại chỗ để cải thiện trải nghiệm. API vẫn chịu trách nhiệm xác thực, validation cuối cùng, transaction và chống xử lý trùng.

## 9. Đánh giá kiến trúc và trade-off

| Quyết định | Lợi ích | Hạn chế và đánh đổi |
|---|---|---|
| **C4 Model** | Làm rõ container và component, thuận tiện đối chiếu Deployment Diagram. | Cần cập nhật sơ đồ khi kiến trúc thay đổi. |
| **Next.js/PWA, mobile-first** | Phù hợp công nghệ bắt buộc và trải nghiệm trên thiết bị di động. | Phải quản lý trạng thái client, caching và xác thực nhất quán. |
| **Tổ chức theo chức năng** | Dễ bảo trì, kiểm thử và phân chia công việc theo nghiệp vụ. | Cần quy ước nhất quán về phụ thuộc giữa các feature. |
| **API Client + proxy cùng origin** | Đồng nhất endpoint `/api/*`, tránh cookie bên thứ ba giữa hai tên miền Render và giảm phụ thuộc trực tiếp vào domain API. | Proxy phải chuyển tiếp chính xác cookie, response, lỗi; cần kiểm thử CSRF và cấu hình HTTPS. |
| **Backend là nguồn dữ liệu nghiệp vụ chính thức** | Bảo đảm chính xác giá, tồn kho và trạng thái thanh toán. | Frontend cần xử lý trạng thái đang chờ và đồng bộ lại dữ liệu. |

## 10. Truy vết thiết kế

| Nhóm yêu cầu | Component | Tài liệu Task 1–2 liên quan |
|---|---|---|
| FR-01–FR-03, NFR-05 | Auth, Catalog | SRS, Activity Customer |
| FR-04, FR-05, FR-19 | Cart | SRS, Activity Customer |
| FR-06, FR-13, FR-16, FR-18, FR-22 | Checkout, API Client | UC-01, Activity Checkout, Sequence Checkout |
| FR-07, FR-14, FR-15 | Payment UI, API Client | UC-01, Sequence Checkout |
| FR-08, FR-23, FR-24 | Orders | SRS, Activity Order Overview |
| FR-09–FR-11, FR-17 | Operations UI | SRS, Use-case Overview, Activity Order Overview |
| FR-12, FR-20, FR-21, NFR-02 | Auth, API Client | SRS, UC-01, Sequence Checkout |
| NFR-06, NFR-08 | BrewLite Web, Checkout, Payment UI | SRS, Assignment 2, Sequence Checkout |

Mã nguồn frontend được triển khai trong `apps/web/`. Các liên kết tới code, test và bằng chứng CI/CD sẽ được cập nhật trong `docs/traceability-matrix.md` khi thực hiện Task 4–5.

## 11. Liên kết triển khai và quyết định kiến trúc

Trong Deployment Diagram, **BrewLite Web** tương ứng mã nguồn **`apps/web/`**, phục vụ người dùng qua HTTPS. Trình duyệt gọi `/api/*` trên BrewLite Web; Next.js chuyển tiếp request đến **BrewLite API** qua HTTPS để sử dụng cookie cùng origin.

**BrewLite API** gồm các module nghiệp vụ, trong đó **PaymentService** là service nội bộ của **PaymentModule**, chạy cùng tiến trình backend và **không triển khai thành dịch vụ/container độc lập**. API kết nối **BrewLite Database** qua URL nội bộ trên Render theo phương án backend/data của nhóm. Biến **`DATABASE_URL`** cùng các secrets chỉ tồn tại trong môi trường backend, không xuất hiện trong mã nguồn hoặc bundle phía trình duyệt.

Sơ đồ triển khai phải thống nhất với C4 tổng thể, tài liệu backend/data và tài liệu thanh toán – vận hành.

Cơ chế phiên được thống nhất giữa frontend và backend là JWT trong `HttpOnly Cookie`, hiệu lực 30 phút, không refresh token ở MVP, có thu hồi khi logout. Proxy Next.js và cơ chế chuyển tiếp `Set-Cookie`/`Cookie` là một phần của kiến trúc triển khai. Deployment Diagram và `AuthModule` phải sử dụng cùng hợp đồng này.


**ADR liên quan:** `docs/architecture/adr/001-frontend-architecture.md`.
