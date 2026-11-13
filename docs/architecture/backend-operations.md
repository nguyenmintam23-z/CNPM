# Vận hành BrewLite API và thanh toán mô phỏng
## 1. Vị trí trong kiến trúc C4

Ở mức Container, BrewLite Web (Next.js/PWA) gọi BrewLite API (NestJS) qua HTTPS. BrewLite API chạy trên Render và kết nối BrewLite Database (PostgreSQL) bằng URL nội bộ. PostgreSQL được cấu hình chặn kết nối từ bên ngoài.

Ở mức Component, PaymentModule chứa PaymentService và chạy cùng tiến trình với NestJS API. Luồng checkout gọi PaymentService để mô phỏng Ví hoặc Thẻ và tra cứu kết quả theo khóa. Luồng checkout chịu trách nhiệm cập nhật Payment, Order và tồn kho trong PostgreSQL. Lifeline Payment Service trong Sequence Diagram biểu diễn lời gọi nội bộ. Deployment Diagram thể hiện PaymentModule bên trong BrewLite API.

## 2. Thanh toán mô phỏng

| Tình huống | Xử lý |
|---|---|
| Bắt đầu thanh toán | Xác thực JWT, vai trò CUSTOMER và quyền sở hữu đơn. Trong transaction, khóa Order, tra cứu Payment theo khóa, kiểm tra đơn PENDING_PAYMENT và chưa có Payment PROCESSING. Xác nhận phần tồn đang giữ còn hợp lệ. Tạo Payment PROCESSING và commit trước khi gọi PaymentService. |
| Thành công | Chỉ khi Payment còn PROCESSING, áp dụng kết quả trong một transaction. Ghi Payment SUCCEEDED, chốt tồn đã giữ và chuyển Order sang CONFIRMED. Sau commit, đơn xuất hiện trong danh sách xử lý của nhân viên và khách thấy mã đơn. |
| Thất bại | Chỉ khi Payment còn PROCESSING, ghi Payment FAILED và giải phóng tồn đã giữ trong cùng transaction. Order vẫn PENDING_PAYMENT và giữ nguyên mã. Giao diện báo lỗi và cho khách thử lại. |
| Timeout hoặc gửi trùng | Tra cứu theo cùng idempotencyKey. Trả PROCESSING nếu chưa có kết quả cuối, hoặc trả kết quả đã lưu. Khi có kết quả cuối, kiểm tra Payment còn PROCESSING và áp dụng trong cùng transaction để thay đổi trạng thái và tồn đúng một lần. |
| Thử lại sau FAILED | Dùng khóa mới trên cùng đơn. Khóa Order và kiểm tra lại điều kiện. Khóa các bản ghi tồn, kiểm tra số lượng có thể bán, giữ lại tồn và tạo Payment mới trong cùng transaction. Nếu thiếu tồn, rollback, báo món thiếu và giữ đơn PENDING_PAYMENT. |
| Hủy đơn đồng thời với thanh toán lại | Cả hai luồng khóa cùng Order. Nếu hủy commit trước, thanh toán thấy đơn đã hủy và dừng. Nếu thanh toán commit trước, hủy thấy Payment PROCESSING và bị từ chối. |

Ràng buộc **UNIQUE (orderId, idempotencyKey)** bảo đảm mỗi khóa chỉ tạo một Payment trên một đơn. Yêu cầu đồng thời phải kiểm tra lại khóa sau khi khóa Order. Lần xử lý ban đầu chỉ gọi bộ mô phỏng sau khi commit Payment mới. Backend chọn kịch bản bằng quy tắc băm cố định từ orderId và idempotencyKey. API từ chối trường kịch bản do client gửi. Tra cứu hoặc gửi lại cùng khóa theo E6 tái hiện cùng kết quả, kể cả sau khi API khởi động lại. Kịch bản phản hồi chậm có thể trả PROCESSING trước khi có kết quả cuối. PostgreSQL lưu Payment theo mô hình hiện có, còn bộ mô phỏng tính kết quả từ đầu vào. Khi API nhận yêu cầu tra cứu hoặc gửi lại theo E6, luồng checkout đọc Payment, lấy kết quả mô phỏng nếu cần và áp dụng kết quả cuối trong transaction khi Payment còn PROCESSING.

Bộ mô phỏng có kịch bản kiểm thử cho thành công, thất bại và phản hồi chậm. Phương thức Ví/Thẻ chỉ là lựa chọn mô phỏng. Hệ thống không thu thập thông tin thẻ thật.

## 3. Logging

NestJS ghi log JSON ra stdout/stderr để xem trong Render. Các trường gồm timestamp, level, event và mã đối chiếu phù hợp như requestId, orderCode hoặc paymentId. Các sự kiện cần ghi gồm tạo Payment, phát hiện yêu cầu trùng, timeout, kết quả cuối, rollback và lỗi kết nối PostgreSQL.

Ví dụ sự kiện khi chưa có kết quả cuối:

```json
{
  "level": "warn",
  "event": "payment_result_pending",
  "requestId": "req-123",
  "orderCode": "BL-001",
  "paymentId": "pay-456",
  "paymentStatus": "PROCESSING"
}
```

Loại trừ JWT, mật khẩu, chuỗi kết nối, khóa thanh toán nguyên văn và nội dung request có thông tin nhạy cảm.

## 4. Health check và smoke test

- NestJS cung cấp GET /health. Trả HTTP 200 khi API sẵn sàng và truy vấn kiểm tra PostgreSQL thành công. Trả HTTP 503 nếu database không truy cập được. Phản hồi chỉ chứa trạng thái tổng quát.
- Đặt /health làm Health Check Path của dịch vụ BrewLite API trên Render.
- Sau khi triển khai, CI gọi URL HTTPS của frontend và GET /health của API. Pipeline báo thất bại nếu không nhận được phản hồi hợp lệ trong thời gian chờ đã cấu hình.
- Kiểm thử checkout riêng để xác nhận luồng thành công, thất bại, gửi trùng, timeout và cạnh tranh với thao tác hủy.

## 5. Cấu hình và secrets

| Biến | Sử dụng |
|---|---|
| DATABASE_URL | URL PostgreSQL nội bộ, cấp riêng cho API trên Render. |
| JWT_SECRET | Khóa ký và kiểm tra JWT, cấp riêng cho API trên Render. |
| PORT | Cổng API lắng nghe theo môi trường chạy. |
| LOG_LEVEL | Mức ghi log, đề xuất info ở production. |

Local dùng Docker Compose và biến môi trường phát triển. Repository lưu .env.example với tên biến và giá trị minh họa. Production đặt giá trị thật trong cấu hình môi trường của Render. Nếu pipeline cần thông tin xác thực để triển khai, lưu thông tin đó trong CI secrets. Frontend chỉ nhận URL công khai của API.

## 6. Lý do lựa chọn và hệ quả

| Quyết định | Lý do chọn và ưu điểm | Hạn chế và đánh đổi |
|---|---|---|
| PaymentService trong NestJS API | Lời gọi nội bộ phù hợp bộ mô phỏng MVP và giảm số dịch vụ cần triển khai trên Render. | Bộ mô phỏng chia sẻ tài nguyên và vòng đời triển khai với API. Tách dịch vụ cho phép mở rộng độc lập, đồng thời tăng chi phí cấu hình mạng và theo dõi lỗi. |
| Log JSON ra stdout/stderr | Render thu log theo tiến trình. Trường sự kiện và mã đối chiếu giúp tra cứu lỗi checkout. | Cần giữ định dạng nhất quán và lọc dữ liệu nhạy cảm. Tra cứu dài hạn phụ thuộc thời gian lưu log. |
| GET /health kiểm tra PostgreSQL | Xác nhận API có thể truy cập dữ liệu trước khi phục vụ checkout. | Mỗi lần kiểm tra thêm một truy vấn nhẹ. Cần giới hạn thời gian chờ để phản hồi 503 khi database gặp lỗi. |
| Secrets qua biến môi trường Render | Cấp cấu hình riêng cho từng môi trường và giữ giá trị thật ngoài repository. | Cần kiểm soát quyền truy cập Render và cập nhật giá trị khi xoay vòng secret. |

## 7. Truy vết và kiểm tra chéo

| Yêu cầu | Thành phần hoặc hành vi |
|---|---|
| FR-07, FR-14 | PaymentService mô phỏng Ví/Thẻ. Checkout cập nhật kết quả thanh toán, đơn và tồn kho. |
| FR-15 | Tra cứu cùng khóa, ràng buộc UNIQUE và áp dụng kết quả một lần. |
| FR-23 | Luồng hủy và thanh toán khóa cùng Order và kiểm tra lại trạng thái. |
| NFR-02 | API bảo vệ xác thực JWT và phân quyền. JWT_SECRET được cấp riêng cho API qua biến môi trường Render. |
| NFR-03 | Mật khẩu được băm trước khi lưu. Log loại trừ mật khẩu và dữ liệu nhạy cảm. |
| NFR-06 | .env.example mô tả biến cấu hình. README hướng dẫn khởi động và Docker Compose chạy web, API và database ở local. |
| NFR-07 | Ghi log khởi động và lỗi. GET /health trả 200 khi API và PostgreSQL hoạt động. |

ĐẠI đối chiếu Deployment Diagram với vị trí PaymentModule, kết nối PostgreSQL nội bộ, secrets, logs và /health. Đối chiếu Sequence checkout với thứ tự commit trước khi gọi PaymentService, tra cứu cùng khóa và cập nhật tồn đúng một lần. DUY đối chiếu ràng buộc dữ liệu và transaction. HOÀNG đồng bộ tên BrewLite Web, BrewLite API và BrewLite Database trong tài liệu C4.

Nguồn nội bộ: SRS, UC-01, Activity checkout, Sequence checkout và bản phân công Task 3.

