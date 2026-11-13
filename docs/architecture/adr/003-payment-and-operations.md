# ADR-003 — Thanh toán mô phỏng và vận hành BrewLite API
## Bối cảnh

BrewLite dùng Next.js, NestJS và PostgreSQL, triển khai trên Render và mô tả kiến trúc theo C4. UC-01 cần mô phỏng Ví/Thẻ, hỗ trợ tra cứu khi timeout và giữ nhất quán trạng thái thanh toán, đơn và tồn kho. Nhóm cần quyết định ranh giới của thành phần mô phỏng và cách theo dõi tình trạng API.

## Quyết định

Đặt PaymentService trong PaymentModule của NestJS API. Luồng checkout gọi nội bộ sau khi commit Payment PROCESSING. PostgreSQL lưu dữ liệu thanh toán và bảo đảm UNIQUE (orderId, idempotencyKey). Checkout chỉ áp dụng kết quả cuối trong transaction khi Payment còn PROCESSING. Thử lại sau FAILED dùng khóa mới. Timeout và gửi trùng dùng cùng khóa.

BrewLite API ghi log JSON, cung cấp GET /health, lấy secrets từ biến môi trường Render và dùng URL PostgreSQL nội bộ. CI chạy smoke test sau khi triển khai. Lý do chọn, ưu điểm và đánh đổi của từng quyết định được trình bày trong mục 6 của [backend-operations.md](../backend-operations.md).

## Lựa chọn khác

Chạy Payment Service thành dịch vụ riêng và gọi qua mạng nội bộ. Phương án này cho phép triển khai và mở rộng phần mô phỏng độc lập, đồng thời cần cấu hình thêm dịch vụ, kết nối mạng và theo dõi lỗi giữa các dịch vụ.

## Hệ quả

Một dịch vụ NestJS xử lý API và mô phỏng thanh toán, nên nhóm chỉ cấu hình một backend trên Render. PaymentModule dùng chung tài nguyên và vòng đời triển khai với API. Khi khách tra cứu hoặc gửi lại theo E6, API đọc Payment hiện có. Nếu cần lấy lại kết quả cuối, backend tái hiện kết quả bằng cùng quy tắc băm cố định từ orderId và idempotencyKey. API từ chối trường kịch bản do client gửi. Cơ chế này dùng mô hình Payment hiện có và chạy theo yêu cầu tra cứu hoặc gửi lại.

C4 Component và Deployment Diagram thể hiện PaymentModule bên trong BrewLite API. Sequence Diagram dùng lifeline Payment Service cho lời gọi nội bộ. Các kịch bản timeout, gửi trùng và cạnh tranh với hủy đơn cần kiểm thử khi triển khai.

