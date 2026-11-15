# BrewLite Sprint 1

## Cấu trúc

- `apps/web/` chứa BrewLite Web (Next.js/PWA).
- `apps/api/` chứa BrewLite API (NestJS, Prisma).
- `docs/` chứa hồ sơ yêu cầu, sơ đồ và kiến trúc của nhóm.
- `.github/workflows/ci.yml` kiểm tra chất lượng trên pull request.
- [Quy trình PR và minh chứng CI](docs/sprint-1-repository-ci.md).

## Product Backlog

**Link Project:** [BrewLite Product Backlog – Sprint 1 và Sprint 2](https://github.com/users/nguyenmintam23-z/projects/2/views/1)

## Chạy local sau khi tích hợp mã

Cấu hình CI đề xuất dùng Node.js 22 và npm riêng cho từng app. Mỗi app cần `package.json`, `package-lock.json` và các script `lint`, `test`, `build`, `dev`. Script `test` chạy unit test một lần và thoát. Duy và Phúc xác nhận các lệnh trước khi bật kiểm tra bắt buộc.

1. Chuẩn bị PostgreSQL local và cơ sở dữ liệu phát triển. Từ `.env.example`, chép nhóm biến Web vào `apps/web/.env.local` và nhóm biến API vào `apps/api/.env`. Điền thông tin PostgreSQL local và giá trị JWT riêng cho môi trường phát triển. Nếu API chạy trong Docker, dùng hostname của dịch vụ database trong Docker Compose thay cho `localhost`.
2. Trong `apps/api`, chạy `npm ci`. Sau khi tích hợp Prisma, chạy `npx prisma migrate deploy` để áp dụng các migration đã commit. Chạy seed bằng script do Duy bàn giao. Chạy `npm run dev` và kiểm tra API tại `http://localhost:3001/products` và `http://localhost:3001/products/<id>`.
3. Trong terminal khác, vào `apps/web`, chạy `npm ci` rồi `npm run dev`. Mở Web tại `http://localhost:3000` và kiểm tra `/api/products` qua proxy của Next.js.
4. Trong từng app, chạy `npm run lint`, `npm test`, `npm run build` để tái hiện các bước CI. Unit test CI cần chạy độc lập với database production. Nếu Prisma Client cần tạo trước khi test hoặc build, app API khai báo bước generate trong script cài đặt hoặc script chuẩn bị tương ứng.

Trình duyệt gọi `/api/*` cùng origin. Next.js server dùng `API_UPSTREAM_URL` để chuyển tiếp đến NestJS, giữ các header cần thiết gồm Cookie và Set-Cookie.

**Giới hạn tạm thời của Sprint 1:** Người dùng có thể xem menu mà chưa cần đăng nhập để kiểm tra tích hợp Web–API. Xác thực JWT qua cookie HttpOnly được hiện thực ở **Task 5 (Sprint 2)**. Khi đó, người dùng phải đăng nhập trước khi xem menu theo thiết kế Task 3.

## Ranh giới CI và triển khai

CI Sprint 1 thực hiện Install → Lint → Unit Test → Build. Theo Task 3, production dùng Render Docker Web Services cho Web/API, Render Postgres với `DATABASE_URL` nội bộ và Docker image do Render build. Secrets thuộc môi trường backend. Phần thanh toán mô phỏng thuộc PaymentModule trong API và được hiện thực theo phạm vi Sprint 2.

## Chạy local bằng Docker

Từ thư mục gốc của repo, nếu chưa có .env, sao chép .env.example bằng lệnh phù hợp với hệ điều hành. Nếu .env đã tồn tại, mở tệp và bổ sung các biến còn thiếu.

**Windows PowerShell**
```powershell
Copy-Item .env.example .env
```
**macOS/Linux**

```bash
cp .env.example .env
```

Điền `POSTGRES_PASSWORD` và `JWT_SECRET` trong `.env`. `POSTGRES_PASSWORD` chỉ dùng chữ cái và chữ số vì Docker Compose chèn trực tiếp mật khẩu vào URL kết nối PostgreSQL.
`JWT_SECRET` cần ít nhất 16 ký tự.
Nếu dùng lại database Compose đã khởi tạo, dùng mật khẩu đã đặt trước đó.

Container API chạy với `NODE_ENV=production`, nên lệnh seed cần hai biến
`SEED_STAFF_PASSWORD` và `SEED_MANAGER_PASSWORD`. Khi chạy lệnh, thay các giá trị
mẫu bên dưới bằng mật khẩu dành riêng cho tài khoản nhân viên và quản lý trên máy local.

**Windows PowerShell**

```powershell
docker compose exec -e "SEED_STAFF_PASSWORD=ThayMatKhauStaffLocal" -e "SEED_MANAGER_PASSWORD=ThayMatKhauManagerLocal" api npx prisma db seed
```

**macOS/Linux**

```bash
docker compose exec -e 'SEED_STAFF_PASSWORD=ThayMatKhauStaffLocal' -e 'SEED_MANAGER_PASSWORD=ThayMatKhauManagerLocal' api npx prisma db seed    
```

Sau khi seed thành công, mở [BrewLite Web](http://localhost:3000).

## Production trên Render

- [BrewLite Web](https://brewlite-web-q4yi.onrender.com)
- [BrewLite API](https://brewlite-api-15lu.onrender.com)
- Kiểm tra hoạt động qua [Web `/healthz`](https://brewlite-web-q4yi.onrender.com/healthz) và [API `/health`](https://brewlite-api-15lu.onrender.com/health).
- [GitHub Release v0.1.1](https://github.com/nguyenmintam23-z/CNPM/releases/tag/v0.1.1) | [GitHub Release v0.1.0](https://github.com/nguyenmintam23-z/CNPM/releases/tag/v0.1.0) | [Releases](https://github.com/nguyenmintam23-z/CNPM/releases)

GitHub Actions chạy lint, test, build và kiểm thử PostgreSQL khi mở PR vào `main`, push lên `main` hoặc push tag `v*`. Sau khi các kiểm tra đạt, CI build hai Docker image gắn với commit SHA. Tag phiên bản trên `main` kích hoạt triển khai. Render build lại hai image từ đúng commit đã kiểm tra bằng Dockerfile của từng dịch vụ.

Trong Render, liên kết hai Docker Web Service với repo, đặt thư mục gốc lần lượt là `apps/api` và `apps/web`, rồi tắt Auto-Deploy để GitHub Actions điều phối phát hành. Đặt health check API là `/health` và Web là `/healthz`. API dùng `DATABASE_URL` nội bộ và `JWT_SECRET` lưu trong Render, giữ mặc định cookie Secure trên HTTPS. Web dùng `API_UPSTREAM_URL` trỏ tới URL HTTPS của API. Trong phần Networking của Render Postgres, tắt truy cập từ bên ngoài và xác nhận API vẫn kết nối qua internal URL.

Tạo GitHub Actions environment `production` với secret `RENDER_API_KEY` và các variables `RENDER_API_SERVICE_ID`, `RENDER_WEB_SERVICE_ID`, `API_URL`, `WEB_URL`. URL production sẽ được điền ở đây sau khi xác nhận địa chỉ Web và API trên Render.

Sau khi workflow đã merge và cấu hình production đã sẵn sàng, tạo tag trên bản `main` đã kiểm tra. Ví dụ với phiên bản đầu tiên:

```bash
git switch main
git pull --ff-only origin main
git tag -a v0.1.0 -m "BrewLite v0.1.0"
git push origin v0.1.0
```

Workflow đợi từng deploy lên trạng thái live, kiểm tra API và Web trả HTTP 200. Khi workflow xanh, tạo GitHub Release từ tag và đính kèm release notes cùng Hoàng. Lưu link workflow run, kết quả health check và xác nhận từ người ngoài nhóm đã clone, chạy theo README và mở được production.

### Nạp dữ liệu mẫu lần đầu

1. Trong **BrewLite-api → Environment**, đặt `SEED_STAFF_PASSWORD` và
   `SEED_MANAGER_PASSWORD` bằng mật khẩu riêng cho hai tài khoản mẫu.
   Nếu thiếu một trong hai biến, seed sẽ dừng và API sẽ không khởi động
   với lệnh tạm bên dưới.
2. Trong **BrewLite-api → Settings → Docker Command**, nhập lệnh sau
   cho lần nạp dữ liệu mẫu đầu tiên:

   ```bash
   npm run start:prod:seed
   ```

3. Khi log báo `Seed xong` và `/health` trả HTTP `200`, xóa lệnh tạm
   trong **Docker Command** rồi lưu. Render sẽ dùng lại lệnh mặc định
   của Dockerfile. Dữ liệu mẫu đã được lưu trong PostgreSQL.


### Rollback production trên Render

Workflow ghi lại deploy đang live của API và Web trước khi phát hành. Nếu phát hành lỗi, workflow yêu cầu Render khôi phục các service đã chuyển sang deploy mới, theo thứ tự Web rồi API, và kiểm tra lại health. Lần phát hành vẫn báo lỗi để nhóm kiểm tra.

Nếu deploy hết thời gian chờ, chưa có bản live trước đó hoặc Render báo rollback lỗi, vào **Render → service → Deploys**. Dừng deploy lỗi nếu nó vẫn đang chạy, chọn bản thành công trước đó rồi bấm **Rollback** nếu bản đó còn khả dụng. Kiểm tra lại API `/health` và Web `/healthz` trả HTTP 200 và lưu link lần chạy.

Rollback trên Render khôi phục phiên bản ứng dụng. Migration đã áp dụng vào PostgreSQL cần xử lý riêng. Giữ migration tương thích với phiên bản trước và kiểm tra dữ liệu trước khi thao tác khôi phục database.

### Tài liệu bàn giao Sprint 2

- [Video demo checkout BrewLite](https://drive.google.com/file/d/14ENn9XkYZKsI86F3nA4lHf-1_9_bIO9G/view?usp=sharing)
- [Release notes v0.1.0](https://github.com/nguyenmintam23-z/CNPM/releases/tag/v0.1.0)
- [Sprint Review](docs/sprint-2-review.md) và [Sprint Retrospective](docs/sprint-2-retrospective.md)
