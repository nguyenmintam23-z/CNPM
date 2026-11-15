# Hợp đồng API – Xử lý đơn tại quầy (Task 5)

Nguồn: SRS FR-09, FR-10, FR-17, FR-24, NFR-02; SRS "Trạng thái đơn" (không được bỏ bước); `backend-data-design.md` §3 (OrdersModule), §5 "Cập nhật tiến độ"; `frontend-architecture.md` §7.4.

Ký hiệu nguồn như `api-products.md`: **[Task trước]** Task 1–3 đã chốt · **[Đề xuất]** chưa ai xác nhận.

Trình duyệt gọi `/api/staff/orders…` của BrewLite Web; proxy chuyển tới `/staff/orders…` của BrewLite API kèm `Cookie` (xem `api-auth.md`).

## 1. Quyền

Chỉ tài khoản `STAFF` (Nhân viên quầy). Chưa đăng nhập → `401`; `CUSTOMER` hoặc `MANAGER` → `403`. **[Task trước]** SRS giao "Xem đơn đã xác nhận; Cập nhật trạng thái đơn" cho Nhân viên quầy, Quản lý chỉ "Tra cứu đơn" (FR-11, API riêng); FR-17 "khách gọi trực tiếp thao tác dành cho nhân viên thì bị từ chối".

Tài khoản thử ở local do seed tạo: `staff@brewlite.local`, mật khẩu đặt bằng `SEED_STAFF_PASSWORD` (xem `prisma/seed.ts`).

## 2. Hàng chờ `GET /staff/orders`

Danh sách đơn đã thanh toán thành công và chưa hoàn tất: `status` là `CONFIRMED`, `PREPARING` hoặc `READY`. Đơn cũ trước.

- Không có đơn chờ thanh toán, đơn thanh toán thất bại (FR-09) và đơn đã hủy (FR-24). **[Task trước]**
- Có cả `PREPARING`, `READY` để nhân viên cập nhật tiếp các bước sau; sắp đơn cũ trước. **[Đề xuất]**

Response `200`: mảng đơn, mỗi đơn cùng cấu trúc như `api-orders.md` §3 (`id`, `orderCode`, `status`, `totalAmount`, `createdAt`, `items` có `productName`, `sizeName`, `toppings`, `quantity`). Không có đơn → `[]`.

## 3. Chi tiết `GET /staff/orders/{id}`

Chi tiết một đơn trong hàng chờ: món, size, topping, số lượng (FR-09). Cùng cấu trúc như trên.

- `400`: `id` không phải UUID.
- `404`: không có đơn, hoặc đơn không nằm trong hàng chờ (chờ thanh toán, đã hủy, đã hoàn tất).

## 4. Cập nhật tiến độ `PATCH /staff/orders/{id}/status`

Chuyển đơn sang bước kế tiếp theo thứ tự `CONFIRMED → PREPARING → READY → COMPLETED` (FR-10).

Request:

```json
{ "from": "CONFIRMED", "to": "PREPARING" }
```

| Trường | Ý nghĩa |
|---|---|
| `from` | Trạng thái đơn đang hiển thị trên màn hình nhân viên |
| `to` | Bước kế tiếp của `from` |

Gửi `from` để backend chỉ ghi khi đơn còn đúng trạng thái đó (cập nhật có điều kiện, **[Task trước]** backend-data-design §5). Tên hai trường là **[Đề xuất]**.

| Mã | Khi nào |
|---|---|
| `200` | Đã chuyển; body là đơn với trạng thái mới |
| `400` `INVALID_TRANSITION` | `to` không phải bước kế tiếp của `from`: bỏ bước, đi lùi, đơn chưa thanh toán (`PENDING_PAYMENT`), đã hủy hoặc đã hoàn tất (FR-10, FR-24) |
| `400` | Thiếu `from`/`to`, giá trị không phải trạng thái đơn, có trường lạ, `id` không phải UUID |
| `409` `ORDER_STATUS_CHANGED` | Đơn không còn ở `from` (nhân viên khác vừa cập nhật, hoặc đơn thật ra chưa thanh toán). Body có `order` là đơn với trạng thái mới nhất (FR-17) |
| `404` | Không có đơn |

Ví dụ `409`:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Trạng thái đơn đã thay đổi, hãy tải lại",
  "code": "ORDER_STATUS_CHANGED",
  "order": { "id": "…", "orderCode": "BL-261115-ABCDE", "status": "PREPARING", "items": [] }
}
```

Cập nhật tiến độ không đổi tồn kho: tồn đã được chốt khi thanh toán thành công.

## 5. Gợi ý cho BrewLite Web

- Màn hình nhân viên hiện mỗi đơn với một nút bước kế tiếp: Bắt đầu chuẩn bị (`CONFIRMED → PREPARING`), Sẵn sàng nhận (`PREPARING → READY`), Hoàn tất (`READY → COMPLETED`). Không cho chọn tự do trạng thái.
- Nhận `409 ORDER_STATUS_CHANGED`: thông báo và thay đơn trên màn hình bằng `order` trong body (frontend-architecture §7.4: "thông báo và tải lại trạng thái mới nhất").
- Đơn `COMPLETED` rời hàng chờ; tải lại danh sách sau khi hoàn tất.
- Khách thấy trạng thái mới khi mở lại chi tiết đơn (FR-08).
