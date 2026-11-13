# ADR-005 — Kho mã nguồn monorepo và cách mô tả kiến trúc

- **Người đề xuất:** Hoàng (Business Analyst)
- **Người duyệt:** Nhóm BrewLite (Hoàng, Duy, Đại, Phúc, Tâm)
- **Trạng thái:** Đã chốt (Đại, Hoàng duyệt ngày 13/11/2026)

## Bối cảnh

- BrewLite có BrewLite Web (Next.js/PWA), BrewLite API (NestJS), tài liệu Task 1–3 và kiểm thử. Nhóm 5 người làm song song trong 2 Sprint (CON-06).
- Task 1 đã chốt: kho mã nguồn theo cấu trúc `apps/web`, `apps/api`, `docs`, `tests`; mọi thay đổi tài liệu và mã nguồn đi qua Pull Request và có lịch sử commit rõ ràng (CON-07). Mọi Pull Request phải qua CI `Install → Lint → Unit Test → Build` trước khi merge (CON-08).
- Đề mục 9 đưa ra cấu trúc thư mục gợi ý, gồm `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`, `docker-compose.yml`, `.env.example`, `README.md`. Đề mục 6.1 yêu cầu repository có `apps/web`, `apps/api`, `docs`.
- Ma trận truy vết (đề mục 8) nối yêu cầu với thiết kế, code/API và test. Code và tài liệu cần nằm ở nơi đối chiếu được với nhau.

## Quyết định

1. **Một repository (monorepo)** chứa toàn bộ mã nguồn, tài liệu và kiểm thử:

   | Thư mục | Nội dung |
   |---|---|
   | `apps/web` | BrewLite Web – Next.js mobile-first/PWA |
   | `apps/api` | BrewLite API – NestJS, chia theo 8 module: `AuthModule`, `UsersModule`, `CatalogModule`, `InventoryModule`, `OrdersModule`, `PaymentModule` (`PaymentService`), `PrismaModule`, `HealthModule` |
   | `docs` | `requirements/`, `diagrams/`, `architecture/` (gồm `adr/`), `traceability-matrix.md`, `deployment.md` |
   | `tests` | Kiểm thử tích hợp và end-to-end |
   | `.github/workflows` | Pipeline CI |

   Mỗi app có Dockerfile riêng (`apps/web/Dockerfile`, `apps/api/Dockerfile`) để Render build thành hai service (xem [ADR-004](004-deployment-render.md)). Cách quản lý phụ thuộc giữa các app (npm workspaces hay mỗi app một `package.json` riêng) do Đại chốt khi dựng repository ở Task 4.1.

2. **Mô tả kiến trúc** bằng C4 Model và UML:
   - C4 Level 1 (System Context) và Level 2 (Container) trong [`architecture-overview.md`](../architecture-overview.md); Level 3 (Component) cho BrewLite Web và BrewLite API.
   - UML Deployment Diagram trong [`diagrams/deployment.puml`](../../diagrams/deployment.puml).
   - Ba container dùng tên thống nhất: `BrewLite Web`, `BrewLite API`, `BrewLite Database`. `PaymentService` nằm trong `PaymentModule` của BrewLite API, không phải container riêng (xem [ADR-003](003-payment-and-operations.md)).

## Lựa chọn khác

- **Nhiều repository (tách repo Web, API và tài liệu):** mỗi app có lịch sử và CI riêng, gọn hơn khi app lớn dần. Không chọn vì trái CON-07, và khó đồng bộ hợp đồng API giữa Web và API, khó đối chiếu ma trận truy vết khi code và tài liệu nằm ở nhiều nơi.
- **Monorepo kèm công cụ quản lý như Nx hoặc Turborepo:** có cache build và chạy CI theo phần thay đổi. Không chọn trong MVP vì chỉ có hai app, công cụ thêm cấu hình và thời gian học cho nhóm. Có thể xem lại nếu CI chạy chậm.

## Hệ quả

**Ưu điểm:**

- Truy vết được từ SRS tới sơ đồ, thư mục mã nguồn (`apps/web`, `apps/api`) và test trong cùng một repository.
- Một Pull Request có thể sửa cả API, Web và tài liệu liên quan, nên hợp đồng API và tài liệu được cập nhật cùng lúc.
- Một nơi duy nhất để bảo vệ nhánh, chạy CI và xem lịch sử commit (CON-07, CON-08).

**Hạn chế và đánh đổi:**

- CI phải chạy cho cả `apps/web` và `apps/api`; khi chỉ sửa tài liệu vẫn có thể chạy cả hai nếu không lọc theo đường dẫn.
- Build context của Docker phải đặt đúng thư mục từng app, nhất là nếu dùng workspaces chung ở gốc repository.
- Nhiều người cùng làm trên một repository dễ xung đột khi merge; cần chia nhánh theo việc và review chéo trước khi merge.

## Liên quan

- [ADR-004](004-deployment-render.md) build Docker từng app trên Render
- [`architecture-overview.md`](../architecture-overview.md), [`traceability-matrix.md`](../../traceability-matrix.md)
