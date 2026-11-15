# Hợp đồng API – Tạo đơn và thanh toán (Task 5)

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

Giới hạn 20 dòng, 20 ly mỗi dòng, 5 topping để chặn dữ liệu bất thường; SRS chỉ yêu cầu số lượng ≥ 1. Giỏ hàng của BrewLite Web dùng cùng giới hạn. **[Nhóm chốt]** Duy và Phúc, 15/11/2026.

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
- Thành công: hiển thị `orderCode`, danh sách món, `totalAmount` và hai phương thức Ví/Thẻ mô phỏng (UC-01 bước 8), rồi gọi API thanh toán ở §6.

## 6. Thanh toán `POST /orders/{id}/payments`

Nguồn: đề 7.1 (thanh toán Ví/Thẻ mô phỏng); SRS FR-07, FR-14, FR-15; UC-01 bước 9–12, A2, E5–E7; Sequence Checkout; `backend-data-design.md` §5; `backend-operations.md` §2.

Trình duyệt gọi `POST /api/orders/{id}/payments` qua proxy. Chỉ `CUSTOMER` là chủ đơn.

```json
{ "method": "WALLET", "idempotencyKey": "7e1f6a52-2c4b-4a3d-9b8e-5d0c1f2a3b4c" }
```

| Trường | Quy tắc |
|---|---|
| `method` | `WALLET` (Ví mô phỏng) hoặc `CARD` (Thẻ mô phỏng). Không nhận thông tin thẻ thật. |
| `idempotencyKey` | Client tạo **một lần cho mỗi lần thử** (nên dùng `crypto.randomUUID()`). Gửi lại do mất phản hồi hoặc để tra cứu kết quả: **giữ nguyên khóa**. Thử lại sau thất bại: **khóa mới** (FR-14, FR-15). 8–64 ký tự chữ, số, `-`, `_`. |

Gửi thêm trường lạ, ví dụ `amount` hay kịch bản mô phỏng, bị từ chối `400`. Số tiền luôn bằng `totalAmount` của đơn; kết quả mô phỏng do server chọn.

### Response

| Mã | Khi nào |
|---|---|
| `200` | Có kết quả cuối: `payment.status` là `SUCCEEDED` hoặc `FAILED`. Thất bại là kết quả nghiệp vụ, không phải lỗi HTTP. |
| `202` | Chưa có kết quả (`PROCESSING`, kịch bản phản hồi chậm). Gửi lại **cùng khóa** sau vài giây để lấy kết quả (E6). |
| `400` | `method` hoặc `idempotencyKey` sai, mã đơn sai định dạng, có trường lạ |
| `401` | Chưa đăng nhập hoặc JWT hết hạn (giữ đơn, đăng nhập lại) |
| `403` | Không phải `CUSTOMER`, hoặc đơn không phải của mình |
| `404` | Không có đơn |
| `409` | `ORDER_NOT_PAYABLE`: đơn không còn chờ thanh toán (đã xác nhận, đã hủy). `PAYMENT_IN_PROGRESS`: đơn đang có lần thanh toán khác chưa xong, hãy tra lần đó bằng khóa cũ. `shortages`: thử lại sau thất bại nhưng món đã hết (E5), đơn vẫn chờ thanh toán. |

```json
{
  "payment": {
    "id": "…uuid…",
    "method": "WALLET",
    "status": "FAILED",
    "amount": 104000,
    "createdAt": "2026-11-15T03:05:00.000Z",
    "completedAt": "2026-11-15T03:05:00.120Z",
    "failureReason": "Ví mô phỏng từ chối giao dịch. Vui lòng thử lại."
  },
  "order": { "id": "…uuid…", "orderCode": "BL-261115-K7Q2M", "status": "PENDING_PAYMENT", "stockHoldStatus": "RELEASED" }
}
```

`failureReason` chỉ có khi `FAILED`.

### Trạng thái sau thanh toán

| Kết quả | Payment | Order | Tồn kho |
|---|---|---|---|
| Thành công | `SUCCEEDED` | `CONFIRMED`, `COMMITTED`; vào hàng chờ nhân viên | Trừ `stock` và `reserved` |
| Thất bại | `FAILED` | Vẫn `PENDING_PAYMENT`, `RELEASED`, giữ mã đơn | Trả lại `reserved` |
| Đang xử lý | `PROCESSING` | Vẫn `PENDING_PAYMENT`, `HELD` | Vẫn giữ |

### Bảo đảm phía server

- Bắt đầu thanh toán là một transaction: khóa dòng đơn → kiểm tra chủ đơn → tra Payment theo `(orderId, idempotencyKey)` **trước** khi xét trạng thái đơn → đơn phải chờ thanh toán, không có lần nào đang xử lý → nếu tồn đã `RELEASED` (thử lại) thì giữ lại tồn → tạo Payment `PROCESSING` → commit.
- Gọi bộ mô phỏng **ngoài** transaction. Áp dụng kết quả trong transaction mới, chỉ khi Payment còn `PROCESSING`, nên chốt hoặc giải phóng tồn đúng một lần, kể cả khi nhiều yêu cầu cùng khóa đến cùng lúc (E7).
- Cùng khóa luôn ra cùng kết quả, kể cả sau khi API khởi động lại (bộ mô phỏng băm `orderId` + `idempotencyKey`).

### Gợi ý cho BrewLite Web

- Tạo `idempotencyKey` khi khách bấm **Xác nhận thanh toán**, giữ đến khi có kết quả cuối.
- `202`: hiển thị **Đang xử lý**, gửi lại cùng khóa sau 2–3 giây (E6).
- `FAILED`: hiển thị `failureReason`, nút **Thử lại** tạo khóa mới. `409 shortages`: báo món hết, đơn vẫn chờ thanh toán (khách có thể hủy đơn, FR-23, xem mục 7).
- `SUCCEEDED`: hiển thị `orderCode` và trạng thái **Đã xác nhận** (UC-01 bước 12).

## 7. Lịch sử, chi tiết và hủy đơn (FR-08, FR-23, FR-24)

Cả ba endpoint chỉ dành cho `CUSTOMER`. Chưa đăng nhập → `401`; vai trò khác → `403` (NFR-02).

### `GET /orders?page=1&pageSize=20`

Lịch sử đơn của tài khoản đang đăng nhập, mới nhất trước (FR-08). Mỗi đơn có `orderCode`, `createdAt`, `totalAmount`, `status` và `id` để mở chi tiết. Đơn đã hủy vẫn nằm trong lịch sử với `status = CANCELLED` (FR-24).

Phân trang là **[Đề xuất]**, SRS không yêu cầu: `page` mặc định 1 (tối thiểu 1); `pageSize` mặc định 20, tối đa 50.

Response `200`:

```json
{ "items": [ /* đơn theo cùng cấu trúc như mục 3 */ ], "page": 1, "pageSize": 20, "total": 21 }
```

Không có đơn: `items` rỗng, `total = 0`; web hiển thị thông báo phù hợp (FR-08). `400` nếu `page` hoặc `pageSize` không phải số nguyên hợp lệ.

### `GET /orders/{id}`

Chi tiết một đơn, cùng cấu trúc như mục 3 (FR-08).

- `200`: đơn của khách, kể cả đơn đã hủy (FR-24).
- `400`: `id` không phải UUID.
- `403`: đơn của tài khoản khác, không trả chi tiết (FR-08). Dùng `403` như mục 6.
- `404`: không có đơn.

### `POST /orders/{id}/cancel`

Hủy đơn chưa thanh toán, giải phóng tồn còn giữ đúng một lần (FR-23). Không có body.

- `200`: đơn đã hủy, `status = CANCELLED`, `stockHoldStatus = RELEASED`. Nếu tồn đã được trả lại sau lần thanh toán thất bại thì không trả thêm (FR-23).
- Đơn đã hủy trước đó: trả `200` với đơn hiện tại, không đổi gì. **[Đề xuất]**
- `409 ORDER_NOT_CANCELLABLE`: đơn không còn chờ thanh toán, tức đã xác nhận trở đi (`orderStatus` kèm theo) (FR-23).
- `409 PAYMENT_IN_PROGRESS`: đang có lần thanh toán chưa xong (FR-23). Đợi kết quả, rồi thử lại.
- `400`, `403`, `404` như mục `GET /orders/{id}`.

Hủy và thanh toán khóa cùng dòng đơn, nên khi gửi đồng thời chỉ một thao tác được chấp nhận (FR-23; backend-data-design §5).

### Đơn đã hủy (FR-24)

- Thanh toán mới cho đơn đã hủy bị từ chối bằng `409 ORDER_NOT_PAYABLE` (mục 6); đơn vẫn `CANCELLED`.
- Không vào hàng chờ nhân viên và không cập nhật tiến độ được: phần này thuộc API nhân viên (FR-09, FR-10), làm ở PR sau.

### Gợi ý cho BrewLite Web

- Nút **Hủy đơn** chỉ hiện khi `status = PENDING_PAYMENT` và không có thanh toán đang xử lý. Vẫn phải xử lý `409`, thông báo và tải lại trạng thái mới (frontend-architecture §7.4).
- Web không tự hoàn trả tồn kho; server làm việc này (frontend-architecture §7.4).
