# Hợp đồng API Product – Sprint 1

Người soạn: Duy (TV2). Người thống nhất: Phúc (BrewLite Web).
Trạng thái: **Đã chốt** giữa Duy và Phúc ngày 13/11/2026.
Phạm vi: Task 4.3, chỉ `GET /products` và `GET /products/:id`.

Ký hiệu nguồn: **[Đề]** Assignment 2 · **[PC]** Phân công Task 4 · **[Task trước]** Task 1–3 đã chốt · **[Nhóm chốt]** Duy và Phúc đã thống nhất · **[Đề xuất]** chưa ai xác nhận.

## 1. Đường dẫn

| Trình duyệt gọi | Next.js proxy chuyển tới BrewLite API | Nguồn |
|---|---|---|
| `GET /api/products` | `GET /products` | [Đề] 6.3; [Task trước] frontend-architecture §7.1 |
| `GET /api/products/:id` | `GET /products/:id` | [Đề] 6.3; [Task trước] frontend-architecture §7.1 |

Trình duyệt không gọi thẳng hostname của API. **[Task trước]** ADR-001

## 2. `GET /products` – danh sách menu

Chỉ trả món đang kinh doanh (`isActive = true`). Món hết hàng **vẫn được trả**, với `availableQuantity = 0`, để menu hiện nhãn hết hàng. **[Task trước]** FR-01

**200 OK**

```json
[
  {
    "id": "6f1c2a3e-8b4d-4c1a-9e2f-1a2b3c4d5e6f",
    "name": "Cà phê sữa",
    "basePrice": 29000,
    "imageUrl": "https://example.com/ca-phe-sua.jpg",
    "availableQuantity": 20
  },
  {
    "id": "0a9b8c7d-6e5f-4a3b-2c1d-0e9f8a7b6c5d",
    "name": "Trà đào",
    "basePrice": 35000,
    "imageUrl": null,
    "availableQuantity": 0
  }
]
```

| Trường | Kiểu | Ghi chú | Nguồn |
|---|---|---|---|
| `id` | string (UUID) | | [Task trước] Class Domain |
| `name` | string | | [Task trước] FR-01 |
| `basePrice` | number | Giá gốc, đơn vị VND, số nguyên | [Task trước] FR-01; [Nhóm chốt] kiểu number và VND |
| `imageUrl` | string \| null | `null` khi món không có ảnh | [Task trước] FR-01 "hiển thị ảnh nếu có" |
| `availableQuantity` | number | `stockQuantity − reservedQuantity`, API tự tính, không lưu trong DB. Bằng 0 thì hiện nhãn hết hàng | [Task trước] Class Domain, FR-01 |

- Menu trống thì trả `200` với `[]`, Web hiện trạng thái empty. **[Đề]** 6.3; **[Task trước]** NFR-05
- Thứ tự sắp theo `name` tăng dần, không phân trang vì menu một cửa hàng ít món. **[Nhóm chốt]**

## 3. `GET /products/:id` – chi tiết món

**200 OK**

```json
{
  "id": "6f1c2a3e-8b4d-4c1a-9e2f-1a2b3c4d5e6f",
  "name": "Cà phê sữa",
  "description": "Cà phê phin pha sữa đặc",
  "basePrice": 29000,
  "imageUrl": "https://example.com/ca-phe-sua.jpg",
  "availableQuantity": 20,
  "sizes": [
    { "id": "a1b2c3d4-0000-4000-8000-000000000001", "name": "S", "extraPrice": 0 },
    { "id": "a1b2c3d4-0000-4000-8000-000000000002", "name": "M", "extraPrice": 5000 }
  ],
  "toppings": [
    { "id": "b1b2c3d4-0000-4000-8000-000000000001", "name": "Trân châu", "price": 7000 }
  ]
}
```

| Trường | Ghi chú | Nguồn |
|---|---|---|
| `description` | Chỉ có ở trang chi tiết | [Task trước] FR-02 |
| `sizes[]` | Size món này cho phép, kèm `extraPrice`. Mảng rỗng nếu món không có size | [Task trước] FR-02, Class Domain (Product – Size 0..*, Size dùng chung); [Nhóm chốt] trả ngay từ Sprint 1 |
| `toppings[]` | Chỉ topping món này cho phép **và** đang bán (`isActive = true`), kèm `price`. Mảng rỗng nếu không có | [Task trước] FR-02, Class Domain; [Nhóm chốt] trả ngay từ Sprint 1 |

**Lưu ý phạm vi:** [Đề] 6.3 chỉ yêu cầu `GET /products/:id` chạy được. Size và topping nằm trong [Đề] 7.1 (Task 5.1 "chi tiết sản phẩm, size và topping"). API trả `sizes`, `toppings` luôn từ Sprint 1 để Task 5 khỏi đổi hợp đồng. Frontend Sprint 1 **chưa hiển thị và chưa xử lý** lựa chọn size, topping. Việc chọn size, topping và tính giá thuộc Task 5. **[Nhóm chốt]**

## 4. Lỗi

Thân lỗi giữ đúng dạng mặc định của NestJS; frontend xử lý theo HTTP status. **[Nhóm chốt]**

```json
{ "statusCode": 404, "message": "Không tìm thấy sản phẩm", "error": "Not Found" }
```

| Mã | Khi nào | Web hiển thị | Nguồn |
|---|---|---|---|
| 400 | `:id` không đúng định dạng UUID | Sản phẩm không tồn tại | [Nhóm chốt], cùng tinh thần NFR-04 (NFR-04 không nêu mã sản phẩm) |
| 404 | Không có món với `id` này | Sản phẩm không tồn tại | [Task trước] FR-02 "thông báo phù hợp khi sản phẩm không tồn tại" |
| 404 | Món đã ngừng kinh doanh (`isActive = false`) | Sản phẩm không tồn tại | [Nhóm chốt]; FR-01 chỉ ghi "không thể đặt mua" |
| 500 | Lỗi máy chủ hoặc database. Thân lỗi không lộ chi tiết nội bộ | Trạng thái error, có nút thử lại | [Đề] 6.3 trạng thái error; [Đề xuất] không lộ chi tiết |

Web hiển thị 400 và 404 giống nhau: "Sản phẩm không tồn tại". **[Nhóm chốt]**

## 5. Đăng nhập

- **Sprint 1:** hai endpoint này chưa yêu cầu đăng nhập. Đây là giới hạn của MVP Sprint 1, phải ghi rõ. **[PC]** mục 3, 7. Ghi trong README. **[Đề xuất]**
- **Task 5 (đã làm, xem [`api-auth.md`](api-auth.md)):** API trả `401` khi chưa có cookie phiên. Web chuyển khách tới trang đăng nhập và không hiện danh sách. **[Task trước]** FR-01, ADR-001

Phúc nên xử lý sẵn nhánh `401` ngay từ Sprint 1 để Task 5 khỏi phải sửa lại. **[Đề xuất]**

## 6. Dữ liệu seed để thử các trạng thái

Seed nằm ở `apps/api/prisma/seed.ts`. **[Đề]** 6.3 "dữ liệu mẫu hoặc database seed"; **[Task trước]** backend-data-design §6. Danh sách món dưới đây là **[Đề xuất]**.

| Món | Mục đích |
|---|---|
| Vài món còn hàng, có size và topping | Thử trạng thái có dữ liệu |
| 1 món `stockQuantity = 0` | Thử nhãn hết hàng (FR-01) |
| 1 món `isActive = false` | Kiểm tra món này không có trong danh sách (FR-01) và trả 404 khi gọi chi tiết |
| 1 món không có ảnh | Thử `imageUrl = null` |
| 1 topping `isActive = false` | Kiểm tra topping này không hiện trong chi tiết |

Thử trạng thái empty: chạy API với database chưa seed. Thử trạng thái error: tắt API. **[Đề xuất]**

## 7. Các điểm đã chốt (Duy – Phúc, 13/11/2026)

1. `basePrice`, `extraPrice`, `price` trả kiểu **number**, đơn vị VND. Database vẫn lưu Decimal theo Class Domain; API chuyển sang number, bảo đảm chính xác vì giá VND là số nguyên.
2. Danh sách sắp theo `name` tăng dần, chưa phân trang ở Sprint 1.
3. Thân lỗi theo dạng mặc định của NestJS; frontend xử lý theo HTTP status.
4. 400 và 404 đều hiển thị "Sản phẩm không tồn tại".
5. API trả `sizes`, `toppings` ngay từ Sprint 1; frontend Sprint 1 chưa hiển thị và chưa xử lý lựa chọn (đề 7.1 xếp vào Task 5.1).
6. Món ngừng kinh doanh trả 404 ở trang chi tiết.

Phúc cũng xác nhận: các trường `id`, `name`, `basePrice`, `imageUrl`, `availableQuantity`; món hết hàng vẫn hiện trên menu; frontend gọi `/api/products` qua Next.js proxy; việc chưa kiểm tra đăng nhập ở Sprint 1 chỉ là giới hạn tạm thời của MVP, không đổi yêu cầu nghiệp vụ đã chốt.

Còn mở: đề xuất xử lý sẵn nhánh `401` ở frontend (mục 5) và danh sách món seed (mục 6) vẫn là **[Đề xuất]**.
