# Hợp đồng API – Tra cứu đơn cho quản lý (Task 5)

Nguồn: SRS FR-11 (Should), NFR-02; SRS mục tác nhân "Quản lý: Đăng nhập; Tra cứu đơn"; `architecture-overview.md` (`MANAGER`); `backend-data-design.md` §3 (OrdersModule), §4.3 (chỉ mục `orders (status)`).

Ký hiệu nguồn như `api-products.md`: **[Task trước]** Task 1–3 đã chốt · **[Đề xuất]** chưa ai xác nhận.

Trình duyệt gọi `/api/manager/orders…` của BrewLite Web; proxy chuyển tới `/manager/orders…` của BrewLite API kèm `Cookie` (xem `api-auth.md`).

## 1. Quyền

Chỉ tài khoản `MANAGER`. Chưa đăng nhập → `401`; `CUSTOMER` hoặc `STAFF` → `403`. **[Task trước]**

Hai API chỉ đọc. Quản lý không cập nhật tiến độ đơn (việc của Nhân viên quầy, FR-10; `PATCH /staff/orders/{id}/status` trả `403` cho `MANAGER`).

Tài khoản thử ở local do seed tạo: `manager@brewlite.local`, mật khẩu đặt bằng `SEED_MANAGER_PASSWORD` (xem `prisma/seed.ts`).

## 2. Danh sách `GET /manager/orders?status=PENDING_PAYMENT&page=1&pageSize=20`

Mọi đơn của cửa hàng, mới nhất trước, gồm cả đơn chờ thanh toán, đơn có lần thanh toán thất bại và đơn đã hủy (FR-11). **[Task trước]**

| Tham số | Ý nghĩa |
|---|---|
| `status` | Không bắt buộc. Một trong `PENDING_PAYMENT`, `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`. Có thì chỉ trả đơn ở trạng thái đó (FR-11: "Khi chọn Chờ thanh toán, danh sách chỉ trả các đơn ở trạng thái đó"). |
| `page`, `pageSize` | Như `GET /orders` (`api-orders.md` §7): mặc định 1 và 20, tối đa 50. **[Đề xuất]** |

Response `200`:

```json
{
  "items": [
    { "id": "…", "orderCode": "BL-261115-ABCDE", "status": "PENDING_PAYMENT", "totalAmount": 10000,
      "createdAt": "…", "items": [], "latestPaymentStatus": "FAILED" }
  ],
  "page": 1, "pageSize": 20, "total": 1
}
```

Mỗi đơn cùng cấu trúc như `api-orders.md` §3, thêm `latestPaymentStatus`: trạng thái lần thanh toán gần nhất (`PROCESSING`, `SUCCEEDED`, `FAILED`), `null` khi chưa thanh toán lần nào. Dùng để đánh dấu đơn có lần thanh toán thất bại ngay trong danh sách. **[Đề xuất]**

`400` khi `status` không phải trạng thái đơn, hoặc `page`/`pageSize` sai.

## 3. Chi tiết `GET /manager/orders/{id}`

Đơn bất kỳ của cửa hàng, cùng cấu trúc như trên (không có `latestPaymentStatus`), thêm `payments`: mọi lần thanh toán, cũ trước.

```json
"payments": [
  { "id": "…", "method": "CARD", "status": "FAILED", "amount": 10000,
    "createdAt": "…", "completedAt": "…", "failureReason": "Thẻ mô phỏng bị từ chối. Vui lòng thử lại." },
  { "id": "…", "method": "WALLET", "status": "SUCCEEDED", "amount": 10000, "createdAt": "…", "completedAt": "…" }
]
```

- `failureReason` chỉ có khi `status = FAILED`, là lý do khách đã thấy khi thanh toán (FR-14). Đáp ứng FR-11 "quản lý thấy kết quả của lần thanh toán đó trong chi tiết".
- `400`: `id` không phải UUID. `404`: không có đơn.

## 4. Gợi ý cho BrewLite Web

- Bộ lọc trạng thái dùng tên trong SRS: Chờ thanh toán, Đã xác nhận, Đang chuẩn bị, Sẵn sàng nhận, Hoàn tất, Đã hủy; "Tất cả" thì không gửi `status`.
- Đơn có `latestPaymentStatus = FAILED` nên có nhãn "Thanh toán thất bại" trong danh sách.
- Chi tiết hiện bảng các lần thanh toán: phương thức, trạng thái, số tiền, thời điểm, lý do thất bại.
- FR-11 là **Should**: làm sau màn hình khách và nhân viên.
