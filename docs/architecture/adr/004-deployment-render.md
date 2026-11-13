# ADR-004 — Triển khai production trên Render

- **Người đề xuất:** Đại (Software Architect), Hoàng (Business Analyst)
- **Người duyệt:** Nhóm BrewLite (Hoàng, Duy, Đại, Phúc, Tâm)
- **Trạng thái:** Đã chốt (Đại, Hoàng duyệt ngày 13/11/2026)

## Bối cảnh

- Đề mục 5.2 yêu cầu deployment diagram phản ánh **đúng nền tảng thực tế** nhóm dùng, và cho nhóm tự chọn: Render, Railway, Fly.io, Azure, AWS, VPS hoặc nền tảng tương đương. Đây là quyết định ảnh hưởng tới cả Web, API và Database, nên cần một ADR riêng (đề mục 5.1: mỗi quyết định quan trọng phải được ghi thành ADR).
- Production phải có: HTTPS cho BrewLite Web và BrewLite API, PostgreSQL có lưu trữ bền vững, container registry, kết nối nội bộ, secrets, health check và log (đề mục 5.2).
- Ràng buộc từ Task 1: đóng gói bằng Docker, `docker-compose.yml` ở local và container image ở production (CON-04); nhóm 5 người, 2 Sprint (CON-06).
- Đề mục 8: không có URL production hoạt động lúc chấm thì phần triển khai của Task 5 không được tính. Nền tảng phải dễ dựng và dễ dựng lại.

## Quyết định

Dùng **Render** cho cả 3 container của C4 Level 2. Chi tiết cấu hình nằm trong [`deployment.md`](../../deployment.md).

| Container | Dịch vụ Render | Ghi chú |
|---|---|---|
| BrewLite Web (`apps/web`) | Web Service, Docker runtime, HTTPS công khai | Chạy Next.js/PWA và proxy `/api/*` cùng origin tới BrewLite API |
| BrewLite API (`apps/api`) | Web Service, Docker runtime, HTTPS | NestJS, gồm `PaymentModule` (`PaymentService` mô phỏng nội bộ); cung cấp `GET /health` |
| BrewLite Database | Render PostgreSQL (dịch vụ có quản lý) | Lưu trữ bền vững do Render quản lý; chỉ nhận kết nối qua URL nội bộ |

1. **Build và registry:** Render lấy commit từ Git, build Docker image từ `apps/web/Dockerfile` và `apps/api/Dockerfile`, lưu image trong **registry riêng do Render quản lý**. GitHub Actions chỉ chạy quality gate (Install → Lint → Unit Test → Build); không dùng GHCR hay Docker Hub.
2. **Mạng:** trình duyệt chỉ gọi BrewLite Web. Next.js server chuyển tiếp `/api/*` và `Cookie` / `Set-Cookie` tới BrewLite API. Lý do: `onrender.com` nằm trong Public Suffix List, nên cookie do API đặt trên hostname riêng bị coi là cookie bên thứ ba (xem [ADR-001](001-frontend-architecture.md)).
3. **Database:** BrewLite API kết nối qua `DATABASE_URL` là URL nội bộ của Render, không mở PostgreSQL ra Internet. Mỗi lần deploy API chạy `prisma migrate deploy` trước khi nhận request. Seed chạy riêng, một lần, từ dịch vụ BrewLite API (xem [ADR-002](002-database-postgresql-prisma.md)).
4. **Secrets và cấu hình:** `DATABASE_URL`, `JWT_SECRET` và URL upstream của proxy đặt trong Environment của từng service trên Render. Không commit vào Git, không đặt trong `NEXT_PUBLIC_*`, Docker image hoặc log.
5. **Vận hành:** Render kiểm tra `GET /health` của BrewLite API và `/` của BrewLite Web (health check theo `deployment.md` §8.1). Log JSON ghi ra `stdout` và xem trong log của từng service trên Render (xem [ADR-003](003-payment-and-operations.md)).

## Lựa chọn khác

- **Railway, Fly.io:** cũng chạy được Docker và có PostgreSQL. Không chọn vì nhóm đã dựng hồ sơ deployment theo Render, và Render gộp đủ Web Service, PostgreSQL, registry, HTTPS, health check, log trong một nơi. Đổi nền tảng lúc này phải làm lại sơ đồ deployment và cấu hình.
- **Kết hợp nhiều nhà cung cấp (ví dụ Vercel cho Web, Render cho API, Supabase cho Database):** mỗi phần dùng dịch vụ mạnh nhất. Không chọn vì phải cấu hình biến môi trường và kết nối chéo giữa các nhà cung cấp; API và Database không còn nằm chung mạng nội bộ, nên database phải mở kết nối ra ngoài.
- **AWS, Azure:** linh hoạt và gần với môi trường doanh nghiệp. Không chọn vì phải tự cấu hình mạng, chứng chỉ và phân quyền nhiều hơn mức cần cho MVP một cửa hàng trong 2 Sprint.
- **Tự vận hành VPS:** kiểm soát toàn bộ máy chủ. Không chọn vì phải tự cài HTTPS, reverse proxy, PostgreSQL, sao lưu và bảo trì hệ điều hành.

## Hệ quả

**Ưu điểm:**

- Một nền tảng có đủ 8 phần tử đề mục 5.2 yêu cầu; deployment diagram ánh xạ trực tiếp sang dịch vụ thật.
- Database không mở ra Internet; API nối qua URL nội bộ.
- Docker giữ cách đóng gói giống nhau giữa local và production (CON-04).
- Render tự build từ Git, nên quy trình phát hành gắn với commit đã qua CI.

**Hạn chế và đánh đổi:**

- Phụ thuộc giới hạn của gói Render nhóm dùng. Gói miễn phí có thể ngủ khi không có truy cập, nên lần gọi đầu bị chậm. PostgreSQL miễn phí có thể có thời hạn. Nhóm phải kiểm tra trước buổi chấm và sẵn sàng chạy lại migration và seed.
- Web và API ở hai hostname `onrender.com` khác nhau, nên bắt buộc dùng proxy cùng origin. Proxy phải chuyển tiếp đúng cookie, status và body.
- Render build image trong registry riêng của nền tảng, nên không có image đẩy ra registry ngoài để dùng lại. Muốn đổi nền tảng thì phải build lại.
- Phải kiểm tra gói Render có hỗ trợ lệnh chạy trước khi deploy (pre-deploy) không. Nếu không, chạy migration ở đầu lệnh khởi động API.

## Liên quan

- [`deployment.md`](../../deployment.md), [`diagrams/deployment.puml`](../../diagrams/deployment.puml)
- [ADR-001](001-frontend-architecture.md) proxy cùng origin và cookie; [ADR-002](002-database-postgresql-prisma.md) PostgreSQL và migration; [ADR-003](003-payment-and-operations.md) health check và log
