# BrewLite API (`apps/api`)

NestJS + Prisma + PostgreSQL.

| Phần | Endpoint | Hợp đồng |
|---|---|---|
| Sản phẩm (Sprint 1) | `GET /products`, `GET /products/:id` | [`api-products.md`](api-products.md) (Duy – Phúc chốt 13/11/2026) |
| Xác thực, health check (Task 5) | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /health` | [`api-auth.md`](api-auth.md) |
| Tạo đơn, thanh toán (Task 5) | `POST /orders/checkout`, `POST /orders/{id}/payments` | [`api-orders.md`](api-orders.md) |
| Xử lý đơn tại quầy (Task 5) | `GET /staff/orders`, `GET /staff/orders/{id}`, `PATCH /staff/orders/{id}/status` | [`api-staff.md`](api-staff.md) |
| Tra cứu đơn cho quản lý (Task 5) | `GET /manager/orders`, `GET /manager/orders/{id}` | [`api-manager.md`](api-manager.md) |

## Trạng thái Task 5

- Mọi API cần đăng nhập (JWT trong cookie HttpOnly, ADR-001), trừ đăng ký, đăng nhập, đăng xuất và `/health`. Giới hạn "menu chưa cần đăng nhập" của Sprint 1 đã bỏ: chưa đăng nhập thì `GET /products` trả `401` (FR-01).
- Bảng đã có: `products`, `sizes`, `toppings`, `product_sizes`, `product_toppings`, `users`, `orders`, `order_items`, `order_item_toppings`, `payments` (schema đơn hàng do Đại phụ trách, PR #54).
- Tạo đơn: một transaction khóa `products` theo `id` tăng dần, kiểm tra lựa chọn và tính giá ở server (`CatalogModule`), giữ tồn (`InventoryModule`), chống tạo trùng bằng `requestId` (`OrdersModule`). Xem `api-orders.md` §4.
- Log JSON ra stdout/stderr (NFR-07, backend-operations §3); mức log theo `LOG_LEVEL`.
- Thanh toán: `PaymentsService` tạo Payment `PROCESSING` trong một transaction, gọi `PaymentService` (mô phỏng Ví/Thẻ) ngoài transaction, áp dụng kết quả đúng một lần; thử lại sau thất bại giữ lại tồn (`api-orders.md` §6).
- Nhân viên quầy: hàng chờ gồm đơn `CONFIRMED`, `PREPARING`, `READY`; cập nhật tiến độ từng bước, ghi có điều kiện theo trạng thái cũ nên hai nhân viên cùng bấm chỉ một yêu cầu được ghi (`api-staff.md`).
- Quản lý: tra cứu mọi đơn, lọc theo trạng thái; chi tiết có các lần thanh toán và lý do thất bại (`api-manager.md`). Chỉ đọc.

## Thanh toán mô phỏng (`src/payment`)

Theo `backend-operations.md` §2 và ADR-003. **[Task trước]**

- Kết quả chọn bằng băm cố định từ `orderId` và `idempotencyKey`: cùng khóa luôn ra cùng kết quả, kể cả sau khi API khởi động lại (FR-15, E6). Client không gửi được kịch bản.
- Tỉ lệ: 70% thành công, 20% thất bại, 5% chậm rồi thành công, 5% chậm rồi thất bại. Kịch bản chậm trả `PROCESSING` cho tới khi qua thời gian chờ tính từ lúc tạo Payment.
- `PaymentService` không ghi database. Luồng checkout ghi Payment, Order, tồn kho trong transaction, chỉ khi Payment còn `PROCESSING` (backend-data-design §5).

Biến môi trường chỉ dùng ở local và kiểm thử E2E (để trống ở production): **[Đề xuất]**

| Biến | Ý nghĩa |
|---|---|
| `PAYMENT_SIM_SCENARIO` | Ép kịch bản: `SUCCESS`, `FAILURE`, `SLOW_SUCCESS`, `SLOW_FAILURE`. Bị bỏ qua khi `NODE_ENV=production` |
| `PAYMENT_SIM_DELAY_MS` | Thời gian phản hồi chậm, mặc định `5000` |

## Cấu trúc

```
apps/api
├── prisma/
│   ├── schema.prisma          # theo Class Domain, backend-data-design §4
│   ├── migrations/            # Prisma Migrate (ADR-002)
│   └── seed.ts                # dữ liệu mẫu, chạy riêng
├── src/
│   ├── catalog/               # CatalogModule: ProductsController, ProductsService
│   ├── prisma/                # PrismaModule
│   ├── app.module.ts
│   └── main.ts
└── test/products.e2e-spec.ts  # kiểm thử HTTP
```

## Chạy ở máy

Cần Node.js 20 trở lên và PostgreSQL với database mã hóa **UTF8**.

```bash
cd apps/api
npm install
# chép nhóm biến API trong .env.example ở gốc repo vào apps/api/.env, sửa DATABASE_URL và JWT_SECRET (tối thiểu 16 ký tự)
npm run prisma:migrate:deploy   # tạo bảng
npm run db:seed                 # nạp dữ liệu mẫu
npm run dev                     # http://localhost:3001
```

Thử nhanh:

```bash
curl http://localhost:3001/health                      # {"status":"ok"}
curl http://localhost:3001/products                    # 401 khi chưa đăng nhập
curl -H "Content-Type: application/json" \
  -d '{"email":"khach@example.com","password":"matkhau123","fullName":"Khach Thu"}' http://localhost:3001/auth/register
curl -c cookie.txt -H "Content-Type: application/json" \
  -d '{"email":"khach@example.com","password":"matkhau123"}' http://localhost:3001/auth/login
curl -b cookie.txt http://localhost:3001/products      # 200
curl -b cookie.txt -X POST http://localhost:3001/auth/logout
```

## Lệnh cho CI

| Bước | Lệnh |
|---|---|
| Install | `npm ci` (tự chạy `prisma generate` ở bước postinstall) |
| Lint | `npm run lint` |
| Unit Test | `npm test` (unit + e2e; e2e dùng database giả nên không cần PostgreSQL) |
| Build | `npm run build` |

## Migration và seed

- Đổi schema: sửa `prisma/schema.prisma`, rồi `npm run prisma:migrate:dev -- --name <ten-thay-doi>` để tạo file migration mới và commit file đó.
- Production: chạy `prisma migrate deploy` mỗi lần deploy API, trước khi API nhận request (backend-data-design §6).
- Seed **chạy riêng**, không đặt trong lệnh start hay Dockerfile. Seed dùng id cố định và `upsert`, nên chạy lại không tạo trùng. Món đang bán có tồn kho seed 500; chạy lại chỉ nạp thêm khi tồn kho thấp hơn mức này (không giảm).
- Ràng buộc `CHECK` tồn kho không âm, không giữ quá số tồn được thêm tay trong migration đầu tiên (backend-data-design §4.3), vì Prisma schema chưa khai báo được `CHECK`.

## Dữ liệu seed

| Món | Dùng để thử |
|---|---|
| Cà phê sữa, Trà sữa trân châu | Có size và topping |
| Trà đào cam sả (tồn = 0) | Nhãn hết hàng, `availableQuantity = 0` |
| Bạc xỉu | Có size, không có topping |
| Nước suối | `imageUrl = null` (thử "ảnh nếu có", FR-01); không có size, topping |
| Sinh tố bơ (ngừng bán) | Không có trong danh sách, chi tiết trả `404` |
| Topping Pudding (ngừng bán) | Không hiện trong chi tiết món |
| 10 món thêm (cà phê, trà, trà sữa, cacao) và 5 topping thêm | Menu đủ món để demo; chưa có ảnh nên `imageUrl = null` |

Ảnh: Cà phê sữa, Trà sữa trân châu, Trà đào cam sả, Bạc xỉu có `imageUrl = /images/products/<tên file>.jpg`, file nằm trong `apps/web/public/images/products/` (PR #61). Chạy lại seed thì cập nhật `imageUrl`, nạp thêm tồn kho như trên, không đổi giá.
