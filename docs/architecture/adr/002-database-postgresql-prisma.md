# ADR-002 — PostgreSQL trên Render và migration bằng Prisma
## Bối cảnh

- Đề bắt buộc dữ liệu lưu trong **PostgreSQL** (mục 1.1) và kiến trúc phải mô tả **cơ chế migration** (mục 5.1). Deployment production phải có **PostgreSQL với persistent storage** và phản ánh nền tảng thực tế nhóm dùng (mục 5.2).
- Nhóm đã chọn **Render** cho production.
- Các task trước yêu cầu database bảo đảm:
  - tạo đơn và giữ tồn kho trong một transaction (FR-16);
  - chống tạo đơn trùng bằng `UNIQUE (user_id, request_id)` (FR-18);
  - chống xử lý thanh toán trùng bằng `UNIQUE (order_id, idempotency_key)` (FR-15);
  - khóa dòng khi đặt đơn, thanh toán, hủy đơn đồng thời (FR-13, FR-23).
- Đề yêu cầu tạo phẩm có lịch sử thay đổi rõ ràng trên repo (mục 1).

## Quyết định

1. Dùng **Render Postgres** cho production, chặn kết nối từ bên ngoài. BrewLite API kết nối qua biến môi trường `DATABASE_URL` bằng URL nội bộ của Render (thống nhất với `backend-operations.md`). Local dùng PostgreSQL trong `docker-compose` (NFR-06).
2. Dùng **Prisma** làm ORM và công cụ migration:
   - schema tại `apps/api/prisma/schema.prisma`;
   - mỗi thay đổi schema là một file migration SQL trong `apps/api/prisma/migrations/`, commit vào repo;
   - production chạy `prisma migrate deploy` mỗi lần deploy API, trước khi API nhận request.
3. Dữ liệu ban đầu (món, size, topping, tồn kho, tài khoản nhân viên và quản lý) nạp bằng `apps/api/prisma/seed.ts`, chạy riêng, không chạy lại mỗi lần deploy. Ở production, seed chạy từ dịch vụ BrewLite API trên Render vì database không nhận kết nối từ bên ngoài.
4. Các ràng buộc UNIQUE, CHECK và enum trạng thái đặt ngay trong database, không chỉ kiểm tra trong code.

## Lựa chọn khác

| Lựa chọn | Lý do không chọn |
|---|---|
| **TypeORM** (thường đi kèm NestJS) | Hỗ trợ khóa dòng (`pessimistic_write`) sẵn có, nhưng migration sinh từ entity khó đọc hơn, dễ lệch giữa entity và database |
| **Viết SQL migration thủ công** (không ORM) | Kiểm soát hoàn toàn, nhưng phải tự viết lớp truy cập dữ liệu và tự quản lý thứ tự migration |
| **Database ngoài Render** (ví dụ dịch vụ PostgreSQL khác) | Thêm một nền tảng phải quản lý; mất kết nối nội bộ giữa BrewLite API và database |

## Hệ quả

- **Tích cực:**
  - Schema Prisma gần với Class Domain, dễ đối chiếu.
  - Lịch sử migration nằm trong repo, đúng yêu cầu của đề về lịch sử thay đổi.
  - Ràng buộc ở database chặn được request trùng đến đồng thời.
- **Cần lưu ý:**
  - Khóa dòng `SELECT ... FOR UPDATE` phải viết bằng SQL thô (`$queryRaw`) trong transaction của Prisma.
  - Code phải bắt lỗi vi phạm UNIQUE để trả lại đơn hoặc Payment đã có.
- **Cần kiểm tra trước khi chốt:**
  - Gói Render nhóm dùng có hỗ trợ lệnh pre-deploy không. Nếu không, chạy migration ở đầu lệnh khởi động API.
  - Giới hạn thời hạn của Render Postgres bản miễn phí, để database còn hoạt động lúc chấm (đề mục 8).

## Liên quan

- `docs/architecture/backend-data-design.md`, `docs/architecture/backend-operations.md`
- `docs/diagrams/class-domain.puml`, `docs/diagrams/sequence-checkout.puml`
- FR-13, FR-15, FR-16, FR-18, FR-23, NFR-06, NFR-08
