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

```powershell
docker compose up --build -d
```
Mở [http://localhost:3001/health](http://localhost:3001/health) để kiểm tra API. Đợi API trả HTTP `200 OK` với nội dung `{"status":"ok"}`, rồi chạy lệnh nạp dữ liệu mẫu.
```
docker compose exec api npx prisma db seed
```

Sau khi seed thành công, mở [BrewLite Web](http://localhost:3000).
Mở Web tại http://localhost:3000 và kiểm tra API tại
http://localhost:3001/health. Chạy seed khi cần nạp dữ liệu mẫu
cho database local.
