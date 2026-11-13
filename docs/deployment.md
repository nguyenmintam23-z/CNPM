# BrewLite – Thiết kế triển khai hệ thống (Production Deployment Design)


## 1. Mục đích và phạm vi

Tài liệu xác định cách **dự kiến triển khai** BrewLite trên môi trường production: thiết bị người dùng, Next.js/PWA, NestJS API, PostgreSQL lưu trữ bền vững, cơ chế build và registry container, kết nối mạng, biến môi trường/secrets, health check, logging và ranh giới **Local – CI – Production**.

Các ràng buộc kỹ thuật đã thể hiện trong hồ sơ:

- **CON-01:** Frontend Next.js theo hướng mobile-first/PWA.
- **CON-02:** Backend NestJS tổ chức theo module/domain.
- **CON-03:** PostgreSQL, quản lý schema qua migration và dữ liệu mẫu/seed.
- **CON-04:** Docker; `docker-compose.yml` ở local và Docker image cho production.
- **CON-05:** Thanh toán Ví/Thẻ **mô phỏng**, không tích hợp cổng thanh toán thật.
- **CON-07/CON-08:** Cấu trúc repository `apps/web`, `apps/api`, `docs`, `tests`; CI theo chuỗi Install → Lint → Unit Test → Build.

**Phương án đang được mô tả là Render**, theo tài liệu Deployment mà nhóm đã cung cấp. Tài liệu không dùng trạng thái đã triển khai làm bằng chứng; tên dịch vụ, URL, vùng triển khai, Dockerfile, endpoint và biến môi trường cụ thể cần được xác nhận với cấu hình thực tế khi hiện thực.

## 2. Quyết định kiến trúc triển khai

### 2.1. Các thành phần production

Dùng **Render Web Service với Docker runtime** cho Next.js và NestJS; dùng **Render PostgreSQL** làm cơ sở dữ liệu quản lý tập trung.

| Thành phần | Đơn vị triển khai thiết kế | Trách nhiệm |
|---|---|---|
| BrewLite Web | Render Web Service (Docker), public HTTPS | Chạy Next.js, cung cấp giao diện/PWA và proxy `/api/*` cùng origin. |
| BrewLite API | Render Web Service (Docker), có HTTPS endpoint trong phương án này | Chạy NestJS, xác thực và phân quyền, nghiệp vụ, REST API; nhận request từ Next.js proxy. |
| PostgreSQL | Render PostgreSQL | Lưu dữ liệu quan hệ trên hệ lưu trữ bền vững do nền tảng quản lý. |
| Container registry | **Render-managed private registry** trong quy trình Docker build của Render | Lưu Docker image do Render build từ Dockerfile của repository. **Không giả định sử dụng GHCR/Docker Hub.** |
| Repository và kiểm tra CI | GitHub + GitHub Actions (thiết kế) | Quản lý nguồn và kiểm tra chất lượng mã trước khi merge. |
| Giám sát vận hành | Render Logs/Metrics và health endpoints của ứng dụng | Ghi nhận log, phát hiện ứng dụng chưa sẵn sàng. |

**Phân biệt trách nhiệm:** GitHub Actions kiểm tra mã nguồn; Render build Docker image từ Git repository và lưu image trong registry do Render quản lý; Render Web Services chạy các image tương ứng. Đó là **thiết kế**, chưa phải bằng chứng workflow đã được cấu hình.

### 2.2. Vì sao dùng Docker?

Docker đáp ứng ràng buộc CON-04 và tạo sự nhất quán giữa cách đóng gói tại local và production. Đổi lại, nhóm cần thiết lập đúng Dockerfile, build context và các phụ thuộc trong monorepo.

### 2.3. Vì sao Payment Service không triển khai riêng?

Theo phạm vi MVP và kiến trúc Task 3, Payment Simulation là **module/service nội bộ của NestJS API**, không phải container riêng hoặc cổng thanh toán thật. Cách này giảm độ phức tạp triển khai nhưng không cho phép scale Payment Service độc lập.

## 3. Sơ đồ và luồng kết nối production

- **Nguồn UML Deployment:** `docs/diagrams/deployment.puml`.
- **Bản kết xuất:** `docs/diagrams/deployment.svg`.

Hai file phải được đồng bộ khi thay đổi sơ đồ; không suy ra bản SVG lỗi thời nếu chưa đối chiếu trực tiếp với `.puml` hiện hành.

### 3.1. Thiết bị người dùng → Next.js

1. Khách hàng, nhân viên quầy và quản lý sử dụng trình duyệt trên điện thoại/máy tính hoặc PWA đã cài đặt.
2. Trình duyệt tải BrewLite Web qua **HTTPS/443** từ Render Web Service.
3. PWA là phiên bản web được cung cấp qua trình duyệt, không phải ứng dụng mobile native triển khai riêng.
4. Theo quy tắc truy cập đã chốt trong hồ sơ Task 3, người chưa đăng nhập không được xem dữ liệu menu. Điều kiện xác thực phải được bảo vệ ở backend, không chỉ ẩn giao diện.

### 3.2. Browser → Next.js proxy → NestJS API (HttpOnly Cookie)

Đây là **luồng kiến trúc đã thống nhất trong tài liệu frontend/backend Task 3**:

1. Browser/PWA chỉ gọi **cùng origin BrewLite Web** qua `/api/*`, ví dụ `POST /api/auth/login`, `GET /api/products`; **không gọi trực tiếp hostname NestJS**.
2. Proxy chạy phía server Next.js chuyển `/api/*` sang đường dẫn NestJS tương ứng (ví dụ `/api/auth/login` → `/auth/login`), giữ HTTP method, body, status và các header cần thiết, đặc biệt là `Cookie`/`Set-Cookie`.
3. NestJS phát JWT qua cookie có các thuộc tính **`HttpOnly; Secure; SameSite=Lax; Path=/`**. Theo thiết kế frontend/backend hiện có, JWT có thời hạn **30 phút**. JWT không được đưa vào nội dung JSON trả về khi đăng nhập và không lưu trong `localStorage`.
4. Proxy chuyển tiếp `Set-Cookie` để trình duyệt lưu cookie theo **origin Web**, không tự gắn `Domain` là hostname API. Các request `/api/*` tiếp theo gửi cookie qua Web, proxy chuyển `Cookie` đến NestJS.
5. AuthModule của NestJS xác minh JWT, quyền vai trò và quyền sở hữu dữ liệu; trả `401`/`403` khi không đủ điều kiện. Theo thiết kế, `GET /api/auth/me` ánh xạ tới `/auth/me`, còn `POST /api/auth/logout` ánh xạ tới `/auth/logout`; đăng xuất xóa cookie và thu hồi `jti` tới lúc token hết hạn. Thiết kế hiện tại không sử dụng refresh token.
6. Với request thay đổi trạng thái, `SameSite=Lax` **không tự bảo đảm chống CSRF trong mọi trường hợp**; thiết kế cần tính đến kiểm tra `Origin` hoặc CSRF token theo cách triển khai được chốt.

**Đường truyền server → server:** Trong phương án Render hiện tại, Next.js proxy truy cập endpoint HTTPS/443 của NestJS Web Service. Nếu sau này đổi sang địa chỉ private network được nền tảng hỗ trợ thì phải điều chỉnh cả tài liệu, sơ đồ và cấu hình cho khớp. Việc sử dụng proxy **không biến** một API Web Service public thành private API; NestJS vẫn là ranh giới bảo mật bắt buộc.

Next.js dùng URL upstream **chỉ phía server**, không đặt hostname upstream hay bí mật vào `NEXT_PUBLIC_*`. CORS không thay thế cho xác thực/phân quyền giữa proxy và API.

### 3.3. NestJS API → PostgreSQL

- API sử dụng **Internal Database URL** của Render PostgreSQL (qua `DATABASE_URL`).
- API và database được thiết kế cùng vùng triển khai để sử dụng kết nối mạng nội bộ; giao thức PostgreSQL dùng cổng **5432**.
- Không công khai database phục vụ request thông thường; chỉ mở quyền kết nối cần thiết.
- PostgreSQL là dịch vụ dữ liệu được Render quản lý có **persistent storage**; dữ liệu không nằm trong filesystem tạm của container API.

### 3.4. Payment Simulation và dữ liệu đơn hàng

Payment Simulation nằm trong NestJS; không gửi giao dịch thật đến ngân hàng, ví hoặc mạng thẻ. Theo nghiệp vụ UC-01/SRS đang được các tài liệu Task 3 viện dẫn:

- Lưu lần thử thanh toán ở trạng thái `PROCESSING` trước khi xác định kết quả.
- Dùng `idempotencyKey` để tránh xử lý trùng cùng một lần thử.
- Thành công: cập nhật thanh toán thành công, xác nhận phần tồn đã giữ và chuyển đơn sang trạng thái xác nhận theo nghiệp vụ.
- Thất bại: lưu kết quả thất bại, giải phóng tồn đã giữ, giữ đơn ở `PENDING_PAYMENT` để người dùng thử lại **trên cùng đơn** bằng khóa mới cho lần thử mới.
- Timeout/chưa xác định kết quả: xử lý tra cứu/thử lại bằng cùng khóa để tránh tạo lần thử thứ hai ngoài ý muốn.

## 4. Giao thức, cổng và phạm vi kết nối

| Nguồn | Đích | Giao thức/cổng | Phạm vi | Mục đích |
|---|---|---|---|---|
| Browser/PWA | BrewLite Web | HTTPS/443 | Internet | Tải giao diện và tài nguyên PWA. |
| Browser/PWA | `/api/*` trên BrewLite Web | HTTPS/443 | Cùng origin | Gọi API qua proxy, gửi cookie thuộc Web. |
| Next.js server proxy | NestJS API Web Service | HTTPS/443 theo thiết kế | Server-to-server | Chuyển tiếp request/response và `Cookie`/`Set-Cookie`. |
| NestJS API | Render PostgreSQL | PostgreSQL/5432 | Mạng nội bộ Render | Truy cập dữ liệu và migration. |
| GitHub Actions | GitHub repository | HTTPS/443 | CI | Lấy mã nguồn, lint, test, build. |
| Render build pipeline | Git repository | Kết nối do nền tảng quản lý | Nhà cung cấp Git/Render | Lấy commit được chọn để Docker build. |

Render xử lý TLS của endpoint HTTPS công khai; ứng dụng vẫn cần xác thực, validate và không đưa thông tin nhạy cảm vào log. Ứng dụng phải lắng nghe trên `0.0.0.0` với cổng do biến `PORT` cung cấp; **không cố định cổng runtime**.

## 5. Container registry và luồng build/deploy dự kiến

### 5.1. Liên hệ với repository

| Dịch vụ | Dockerfile dự kiến | Nguồn/build context dự kiến |
|---|---|---|
| BrewLite Web | `apps/web/Dockerfile` | `apps/web/` và các workspace dùng chung nếu có. |
| BrewLite API | `apps/api/Dockerfile` | `apps/api/` và các workspace dùng chung nếu có. |

Đây là đường dẫn **dự kiến theo cấu trúc monorepo**, chưa xác minh trong mã nguồn. Nếu dependency/workspace nằm ở gốc repository thì build context có thể cần đặt ở gốc.

### 5.2. Quan hệ giữa CI, Render build và registry

Luồng kiến trúc **đề xuất**:

1. Lập trình viên tạo Pull Request từ nhánh làm việc.
2. GitHub Actions thực hiện **Install → Lint → Unit Test → Build**.
3. Quy tắc kiểm tra bắt buộc trước merge được xác định trong thiết kế làm việc nhóm.
4. Với phương án Render Dockerfile kết nối Git, Render nhận commit cần triển khai, build image và lưu image vào **Render-managed private registry**.
5. Render Web Services sử dụng image tương ứng để chạy Next.js và NestJS.
6. Khi triển khai thực tế, cấu hình health check và trình tự phát hành cần được xác minh để bảo đảm thay đổi chỉ được phát hành sau khi đạt quality gate.

**Phân định phạm vi Assignment:** Task 3 yêu cầu **thể hiện kiến trúc triển khai và ranh giới CI/production**, không yêu cầu nộp bằng chứng pipeline chạy hoặc chứng minh cấu hình chặn deploy thực tế. Vì vậy, mũi tên “CI đạt → Render build” trong sơ đồ và các bước trên mô tả **quy trình mục tiêu**, không xác nhận hệ thống đã thiết lập một deployment gate hoạt động. Chưa có bằng chứng cấu hình thực tế thì không ghi là “đã chặn deploy”.

Trong cách build từ Git/Dockerfile này, không có cơ sở để ghi rằng **GitHub Actions push application image lên registry**; thao tác build và lưu image do Render thực hiện. GHCR/Docker Hub chỉ là phương án khác nếu nhóm thay đổi quyết định sang triển khai image build sẵn, **không phải thành phần của phương án hiện tại**.

## 6. Ranh giới Local – CI – Production

| Hạng mục | Local | CI (thiết kế) | Production (thiết kế) |
|---|---|---|---|
| Runtime | Docker Compose | GitHub Actions runner | Render Docker Web Services |
| Frontend | Next.js container | Lint/test/build | BrewLite Web |
| Backend | NestJS container | Lint/test/build | BrewLite API |
| Database | PostgreSQL local, volume riêng | Database phục vụ test nếu cần | Render PostgreSQL có persistent storage |
| Cấu hình | `.env` local, `.env.example` mẫu | Biến môi trường/secrets dành riêng cho CI | Render Environment Variables/Secrets |
| Nguồn mã | Máy lập trình viên | Commit/Pull Request | Nhánh/commit được lựa chọn phát hành |
| Logs | Docker Compose logs | CI job logs | Render service logs |
| Mục tiêu | Phát triển, thử nghiệm | Kiểm tra chất lượng | Phục vụ người dùng thực tế |

Không commit `.env`, mật khẩu database, JWT signing key, token truy cập hoặc thông tin thanh toán nhạy cảm. Chỉ commit `.env.example` với tên biến và giá trị ví dụ an toàn.

## 7. Quản lý cấu hình và secrets

Các tên dưới đây là **tên biến đề xuất trên cơ sở tài liệu**, chưa khẳng định đã tồn tại trong code.

| Dịch vụ | Biến | Mục đích |
|---|---|---|
| Web | `NODE_ENV=production` | Môi trường runtime. |
| Web | `PORT` | Cổng do Render cung cấp. |
| Web | `API_UPSTREAM_URL` *(đề xuất)* | URL NestJS upstream **chỉ dùng trên Next.js server** cho proxy `/api/*`. |
| API | `NODE_ENV=production` | Môi trường runtime. |
| API | `PORT` | Cổng do Render cung cấp. |
| API | `DATABASE_URL` **(secret)** | Internal Database URL của Render PostgreSQL. |
| API | `JWT_SECRET` **(secret)** | Khóa ký/xác minh JWT. |
| API | `CORS_ORIGIN` *(tùy chọn)* | Chỉ cần nếu thực tế có client cross-origin được cho phép; không cần cho Browser → Web proxy cùng origin. |

Client browser chỉ gọi URL tương đối `/api/*`; thiết kế này **không cần `NEXT_PUBLIC_API_BASE_URL`**. Không đặt secrets trong `NEXT_PUBLIC_*`, Docker image, source code hoặc logs. Dùng secrets riêng cho từng môi trường.

## 8. Health check và logging

### 8.1. Health check

| Dịch vụ | Endpoint thiết kế | Kết quả kỳ vọng |
|---|---|---|
| BrewLite Web | `GET /healthz` | `200 OK` khi Next.js sẵn sàng; route riêng, không yêu cầu đăng nhập và không chuyển hướng (trang `/` có thể chuyển sang đăng nhập theo FR-01). |
| BrewLite API | `GET /health` | Kiểm tra PostgreSQL bằng một truy vấn nhẹ có timeout ngắn: `200 OK` khi API và database sẵn sàng; `503` khi database không truy cập được. Phản hồi chỉ chứa trạng thái tổng quát, ví dụ `{"status":"ok"}`. |

Hợp đồng `GET /health` thống nhất với [`backend-operations.md`](architecture/backend-operations.md) mục 4. Phản hồi không tiết lộ thông tin nội bộ. Endpoint và dashboard health check mới là **hợp đồng thiết kế**, chưa khẳng định đã có code chạy.

### 8.2. Logging

- Ghi log có cấu trúc ra `stdout`/`stderr` để Render thu thập.
- Trường an toàn có thể gồm thời gian, mức độ, service, môi trường, `requestId`, tuyến API, status, thời lượng và mã lỗi.
- Không log mật khẩu, JWT, nội dung cookie, `Authorization`, connection string, số thẻ hoặc dữ liệu thanh toán nhạy cảm.
- Tránh ghi toàn bộ request body ở endpoint đăng ký/đăng nhập/thanh toán.
- Render Logs/Metrics phục vụ quan sát hệ thống; chính sách lưu log dài hạn là quyết định vận hành bổ sung nếu cần.

## 9. Migration và lưu trữ dữ liệu

- Quản lý thay đổi schema PostgreSQL bằng **Prisma Migrate** theo [ADR-002](architecture/adr/002-database-postgresql-prisma.md); migration nằm trong `apps/api/prisma/migrations/` và được áp dụng ở mỗi lần triển khai BrewLite API (lệnh pre-deploy, hoặc đầu lệnh khởi động nếu gói Render không hỗ trợ).
- Migration production là bước phát hành có kiểm soát, cần xem xét tương thích phiên bản và phương án khôi phục dữ liệu.
- Seed chạy riêng, không chạy lại mỗi lần triển khai để không ghi đè tồn kho thật. Seed production chạy một lần từ dịch vụ BrewLite API trên Render vì database chặn kết nối từ bên ngoài (xem `backend-data-design.md` mục 6).
- Cơ sở dữ liệu phải sử dụng internal URL và storage bền vững do Render PostgreSQL quản lý.
- Các container ứng dụng có thể thay thế; không dựa vào filesystem của chúng để lưu dữ liệu quan hệ lâu dài.

## 10. Nguyên tắc bảo mật trong thiết kế

1. Client truy cập Web qua HTTPS; chỉ gửi request ứng dụng đến origin Web và `/api/*`.
2. NestJS luôn thực hiện xác thực JWT và kiểm tra quyền vai trò/quyền sở hữu phía server.
3. Cookie theo thiết kế: `HttpOnly; Secure; SameSite=Lax; Path=/`; cần kiểm tra CSRF đối với thao tác thay đổi dữ liệu.
4. API Web Service có endpoint HTTPS public trong phương án hiện tại, không được mô tả sai là dịch vụ private chỉ vì có proxy.
5. PostgreSQL dùng kết nối nội bộ, không tạo endpoint database công khai phục vụ ứng dụng.
6. Validate dữ liệu phía backend; frontend validation chỉ hỗ trợ trải nghiệm người dùng.
7. Secrets quản lý qua Render/CI theo môi trường; tuyệt đối không công bố trong code/log.
8. Payment mô phỏng; không sử dụng thông tin thẻ/ngân hàng thật.
9. Đảm bảo idempotency và transaction theo đặc tả nghiệp vụ đơn hàng/thanh toán.

## 11. Truy vết Deployment đến kiến trúc và mã nguồn dự kiến

Theo yêu cầu Task 3.2, mỗi thành phần triển khai phải có trách nhiệm tương ứng trong tài liệu kiến trúc và vị trí mã nguồn **dự kiến**. Đường dẫn dưới đây chưa phải kết quả xác minh repository thực tế.

| Thành phần Deployment | Chức năng kiến trúc | Vị trí mã nguồn/cấu hình dự kiến |
|---|---|---|
| Browser/PWA | Giao diện khách hàng/nhân viên | `apps/web/` |
| Render Web + Next.js proxy | Next.js/PWA, `/api/*`, chuyển tiếp cookie | `apps/web/`, `apps/web/Dockerfile`; file proxy chưa xác minh |
| Render API | NestJS REST, auth, validate, nghiệp vụ | `apps/api/`, `apps/api/Dockerfile` |
| `AuthModule`, `UsersModule` | JWT HttpOnly Cookie, quyền và phiên đăng nhập | `apps/api/src/auth/`, `apps/api/src/users/` (dự kiến) |
| `CatalogModule` | Menu, chi tiết sản phẩm, size, topping | `apps/api/src/catalog/` (dự kiến) |
| `OrdersModule` | Đặt đơn, trạng thái, hàng chờ nhân viên, tra cứu của quản lý (giỏ hàng nằm ở BrewLite Web) | `apps/api/src/orders/` (dự kiến) |
| `InventoryModule` | Giữ, chốt, giải phóng tồn kho | `apps/api/src/inventory/` (dự kiến) |
| `PaymentModule` (`PaymentService`) | Thanh toán Ví/Thẻ mô phỏng, chống trùng | `apps/api/src/payment/` (dự kiến) |
| `PrismaModule`, `HealthModule` | Kết nối PostgreSQL, transaction; `GET /health` | `apps/api/src/prisma/`, `apps/api/src/health/` (dự kiến) |
| BrewLite Database (Render PostgreSQL) | Lưu trữ bền vững, schema/migration | `apps/api/prisma/` (Prisma theo ADR-002) |
| Render-managed private registry | Lưu Docker image đã build | Tài nguyên nền tảng, **không** phải thư mục nguồn |
| GitHub Actions | Kiểm tra chất lượng mã | `.github/workflows/` (dự kiến) |
| Health và logs | Readiness, log tập trung | `GET /health` và logger trong `apps/api/` (dự kiến) |

Các quan hệ và yêu cầu nghiệp vụ chi tiết cần được đối chiếu thêm bằng `docs/traceability-matrix.md` trong hồ sơ đã chốt.

## 12. Ưu điểm, hạn chế và trade-off

| Quyết định | Ưu điểm | Hạn chế/rủi ro và định hướng xử lý |
|---|---|---|
| Docker trên Render | Phù hợp CON-04, nhất quán cách đóng gói | Phải kiểm tra Dockerfile và build context của monorepo. |
| Web và API tách dịch vụ, qua Next.js proxy | Phân lớp rõ; browser dùng cookie first-party và URL cùng origin | Proxy phải bảo toàn cookie/header/lỗi; thêm một bước chuyển tiếp; cần kiểm tra CSRF. |
| API Render Web Service có endpoint HTTPS public | Next.js dễ gọi upstream qua HTTPS | Hostname API vẫn có thể truy cập từ Internet; NestJS phải áp dụng xác thực và phân quyền. |
| Render PostgreSQL | Cơ sở dữ liệu quản lý, lưu trữ bền vững | Phụ thuộc gói dịch vụ, chính sách backup và chi phí. |
| Payment Simulation nằm trong API | Triển khai đơn giản, đúng phạm vi mô phỏng | Không scale riêng; giữ ranh giới module rõ để có thể tách sau. |
| Render-managed private registry | Không phải cấu hình registry ngoài khi Render build từ Git | Phụ thuộc cơ chế build/phát hành của Render; cần gắn image với commit và định nghĩa quality gate. |

## 13. Tiêu chí đối chiếu **thiết kế Task 3**

- [x] Có mô tả thiết bị người dùng, Browser/PWA và Web/CDN/dịch vụ Next.js.
- [x] Có NestJS API, PostgreSQL và phương án persistent storage.
- [x] Có container registry và nền tảng triển khai theo phương án Render.
- [x] Có HTTPS, cổng/kết nối server-to-server, kết nối nội bộ API–PostgreSQL.
- [x] Có secrets/biến môi trường, health check và logging.
- [x] Có phân biệt Local – CI – Production.
- [x] Có truy vết từ node Deployment sang kiến trúc và thư mục mã nguồn **dự kiến**.
- [x] Luồng xác thực tương thích phương án Next.js proxy và HttpOnly Cookie.
- [ ] Đối chiếu bản cuối của SRS/Task 2 và quyết định Render đã phê duyệt chính thức (nếu chưa có biên bản/xác nhận).

**Không đưa vào tiêu chí hoàn thành Task 3:** bằng chứng CI chạy thành công, chặn merge/deploy thật, container/service đã tạo, URL production hoạt động, migration chạy production hoặc smoke test. Những nội dung này thuộc giai đoạn hiện thực của Assignment, không phải điều kiện để đánh giá **nội dung sơ đồ kiến trúc** ở Task 3.

## 14. Tài liệu tham khảo kỹ thuật

- Render Web Services: https://render.com/docs/web-services
- Docker on Render: https://render.com/docs/docker
- Render Private Network: https://render.com/docs/private-network
- Render PostgreSQL: https://render.com/docs/databases
- Render Health Checks: https://render.com/docs/health-checks
- Render Deploys: https://render.com/docs/deploys

---

## 15. Phụ lục – Các cấu hình thiết kế cần bảo toàn

### 15.1. Biến môi trường

- Web: `NODE_ENV`, `PORT`, `API_UPSTREAM_URL` (**tên đề xuất**).
- API: `NODE_ENV`, `PORT`, `DATABASE_URL` (**secret**), `JWT_SECRET` (**secret**), `CORS_ORIGIN` (**tùy chọn**).
- Frontend trình duyệt gọi `/api/*` tương đối; không cấu hình `NEXT_PUBLIC_API_BASE_URL` nếu không có quyết định kiến trúc mới.

### 15.2. Phân chia trách nhiệm theo môi trường

- **Local:** Docker Compose để phát triển và thử nghiệm.
- **CI:** Runner thực hiện kiểm tra mã; **được thể hiện như một môi trường trong Deployment**, không coi là đã cấu hình pipeline.
- **Production:** Render Docker Web Services, Render PostgreSQL và registry do Render quản lý theo phương án thiết kế.

### 15.3. Các đường dẫn quy chiếu

- Frontend: `apps/web/`; Backend: `apps/api/`; CI: `.github/workflows/`.
- Cơ sở dữ liệu/migration theo thiết kế backend: `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/` **nếu** sử dụng Prisma.
- Sơ đồ: `docs/diagrams/deployment.puml`, `docs/diagrams/deployment.svg`.

### 15.4. Hợp đồng health check

- NestJS: `GET /health` kiểm tra PostgreSQL với timeout ngắn; trả `200 OK` khi sẵn sàng, `503` khi database không truy cập được; nội dung có thể là `{"status":"ok"}`; không để lộ secrets/stack trace.
- Next.js: `GET /healthz` trả `200 OK`, không cần đăng nhập và không chuyển hướng, để Render thực hiện readiness check.
- Đây là endpoint theo thiết kế; cần triển khai và kiểm thử ở giai đoạn lập trình.

### 15.5. Phạm vi thể hiện CI trong Task 3

Sơ đồ cho thấy **quan hệ kiến trúc**: source → CI checks → Render build → managed registry → Web/API. Nó **không chứng minh** hoặc cam kết đã cấu hình auto-deploy “After CI Checks Pass”, branch protection hay workflow phát hành. Quy trình thực thi và minh chứng sẽ được làm ở task liên quan; không dùng việc chưa có chúng làm lỗi của Task 3.

### 15.6. Hợp đồng kết nối Browser – Web – API

Browser → Web `/api/*` cùng origin → Next.js server proxy → NestJS API; proxy bảo toàn `Cookie`/`Set-Cookie`; JWT HttpOnly Cookie được NestJS xác minh. Đường API upstream trong phương án này là HTTPS/443; URL upstream là cấu hình server-only. Không thay về Browser → NestJS trực tiếp hoặc JWT `localStorage` nếu không có thay đổi đã được nhóm thông qua.