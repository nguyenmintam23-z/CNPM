# Hợp đồng API – Tạo đơn (Task 5)

Nguồn: đề 7.1 (tạo đơn hàng); SRS FR-06, FR-12, FR-13, FR-16, FR-18, FR-22; UC-01 bước 5–8, E1–E4, E8; Sequence Checkout; `backend-data-design.md` §5; schema Đại chốt (PR #54).

Trình duyệt gọi `POST /api/orders/checkout` của BrewLite Web; proxy chuyển tới `POST /orders/checkout` của BrewLite API kèm `Cookie` (xem `api-auth.md`).

## 1. Request

Chỉ tài khoản `CUSTOMER`. Body chỉ có **lựa chọn**, không có giá: server tự tính giá (FR-06). Gửi thêm trường lạ, ví dụ `price`, `totalAmount`, bị từ chối `400`.

```json
{
  "requestId": "0d6c9a3e-6f1b-4c0e-9a51-2b7f8f3f4a10",
  "items": [
    {
      "productId": "c1b2c3d4-0000-4000-8000-000000000002",
      "sizeId": "a1b2c3d4-0000-4000-8000-000000000003",
      "toppingIds": ["b1b2c3d4-0000-4000-8000-000000000001"],
      "quantity": 2
    },
    { "productId": "c1b2c3d4-0000-4000-8000-000000000005", "quantity": 1 }
  ]
}
```

| Trường | Quy tắc |
|---|---|
| `requestId` | Client tạo **một lần** cho mỗi lần bấm xác nhận đặt đơn (nên dùng `crypto.randomUUID()`), **giữ nguyên khi gửi lại** do mất phản hồi. 8–64 ký tự chữ, số, `-`, `_` (FR-18). |
| `items` | 1–20 dòng. Một món có thể nằm ở nhiều dòng nếu khác size/topping. |
| `productId` | UUID của món đang kinh doanh. |
| `sizeId` | Bắt buộc nếu món có size; **bỏ trống** nếu món không có size (ví dụ Nước suối). |
| `toppingIds` | Tùy chọn, tối đa 5, không lặp, phải thuộc món và đang bán. |
| `quantity` | Số nguyên 1–20 cho mỗi dòng. |

Giới hạn 20 dòng, 20 ly mỗi dòng, 5 topping là **[Đề xuất]** để chặn dữ liệu bất thường; SRS chỉ yêu cầu số lượng ≥ 1.

## 2. Giá

Theo cách tính thống nhất với Đại:

- `sizePrice` = phụ thu của size lúc đặt (0 nếu món không có size).
- `unitPrice` = giá gốc + `sizePrice` + tổng giá topping.
- `lineTotal` = `unitPrice` × `quantity`.
- `totalAmount` = tổng `lineTotal`.

Tiền là **number**, đơn vị VND, như `api-products.md`. Giá được lưu lại tại thời điểm đặt, sau này đổi giá menu không làm đổi đơn cũ.

## 3. Response

| Mã | Khi nào | Body |
|---|---|---|
| `201` | Tạo đơn mới | Đơn (dưới đây) |
| `200` | Gửi lại **cùng `requestId`, cùng nội dung** (E4) | Chính đơn đã tạo lần trước; không tạo đơn mới, không giữ tồn lần hai |
| `400` | Dữ liệu sai (E1) | Lỗi kiểm tra trường (mặc định NestJS), hoặc `lines` chỉ dòng cần sửa |
| `401` | Chưa đăng nhập, JWT hết hạn hoặc đã đăng xuất (FR-12, A1) | Giữ giỏ, chuyển đăng nhập |
| `403` | Tài khoản không phải `CUSTOMER` (E8) | |
| `409` | Thiếu hàng (E2) → `shortages`; hoặc `requestId` đã dùng cho nội dung khác → `code: "REQUEST_ID_REUSED"` | |

Đơn trả về (201/200):

```json
{
  "id": "…uuid…",
  "orderCode": "BL-261115-K7Q2M",
  "requestId": "0d6c9a3e-6f1b-4c0e-9a51-2b7f8f3f4a10",
  "status": "PENDING_PAYMENT",
  "stockHoldStatus": "HELD",
  "totalAmount": 104000,
  "createdAt": "2026-11-15T03:00:00.000Z",
  "items": [
    {
      "productId": "c1b2c3d4-0000-4000-8000-000000000002",
      "productName": "Trà sữa trân châu",
      "sizeId": "a1b2c3d4-0000-4000-8000-000000000003",
      "sizeName": "L",
      "sizePrice": 10000,
      "toppings": [{ "id": "b1b2c3d4-0000-4000-8000-000000000001", "name": "Trân châu", "price": 7000 }],
      "quantity": 2,
      "unitPrice": 52000,
      "lineTotal": 104000
    }
  ]
}
```

Lỗi dòng cần sửa (`400`): `index` là vị trí dòng trong `items` client gửi (từ 0).

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Giỏ hàng có món cần sửa",
  "lines": [
    { "index": 0, "productId": "…", "code": "SIZE_REQUIRED", "message": "Chọn size cho Trà sữa trân châu" },
    { "index": 1, "productId": "…", "code": "TOPPING_NOT_ALLOWED", "message": "Topping đã chọn không áp dụng hoặc đã ngừng bán cho Bạc xỉu" }
  ]
}
```

`code`: `PRODUCT_NOT_FOUND`, `PRODUCT_INACTIVE`, `SIZE_REQUIRED`, `SIZE_NOT_ALLOWED`, `TOPPING_NOT_ALLOWED`, `TOPPING_DUPLICATED`.

Thiếu hàng (`409`): số lượng gộp theo món.

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Một số món không đủ hàng",
  "shortages": [
    { "productId": "…", "name": "Trà đào cam sả", "requested": 1, "available": 0, "code": "OUT_OF_STOCK", "message": "Trà đào cam sả đã hết hàng" },
    { "productId": "…", "name": "Bạc xỉu", "requested": 3, "available": 2, "code": "INSUFFICIENT_STOCK", "message": "Bạc xỉu chỉ còn 2 ly" }
  ]
}
```

## 4. Bảo đảm phía server

- Một transaction: khóa các dòng `products` theo `id` tăng dần → kiểm tra lựa chọn và tính giá → kiểm tra tồn (`stock − reserved`) → tạo đơn `PENDING_PAYMENT` / `HELD` → tăng `reserved_quantity`. Lỗi ở bước nào cũng hoàn tác hết, không còn đơn dở, tồn như cũ (FR-16).
- Hai khách giành ly cuối cùng lúc: chỉ một đơn được tạo, người còn lại nhận `409 OUT_OF_STOCK` (FR-13 (6)).
- Hai yêu cầu cùng `requestId` chạy song song: chỉ một đơn, giữ tồn một lần (FR-18); nhờ `UNIQUE (user_id, request_id)`.

## 5. Gợi ý cho BrewLite Web

- Tạo `requestId` khi khách bấm **Xác nhận đặt đơn**; lưu tạm cùng giỏ để gửi lại đúng mã nếu mất phản hồi. Chỉ tạo mã mới khi khách đổi giỏ.
- Gặp `400` có `lines`: tô đỏ đúng dòng theo `index`, giữ giỏ. Gặp `409 shortages`: báo món hết/thiếu, cho khách giảm số lượng hoặc xóa món, giữ giỏ (FR-13).
- Gặp `401`: giữ giỏ, chuyển đăng nhập rồi quay lại checkout (FR-12, A1).
- Thành công: hiển thị `orderCode`, danh sách món, `totalAmount` và hai phương thức Ví/Thẻ mô phỏng (UC-01 bước 8). API thanh toán ở PR sau.
