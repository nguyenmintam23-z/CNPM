# BrewLite API (`apps/api`)

NestJS + Prisma + PostgreSQL. Sprint 1 (Task 4.3) hiện thực `GET /products` và `GET /products/:id` theo hợp đồng [`api-products.md`](api-products.md) (Duy – Phúc chốt 13/11/2026).

## Giới hạn của MVP Sprint 1

- Hai endpoint Product **chưa yêu cầu đăng nhập**. Đây là giới hạn tạm thời của Sprint 1, không thay đổi yêu cầu FR-01 "chưa đăng nhập thì không trả danh sách". JWT trong HttpOnly Cookie được làm ở Task 5 (ADR-001); khi đó chưa đăng nhập sẽ trả `401`.
- Mới có bảng của phần Catalog: `products`, `sizes`, `toppings`, `product_sizes`, `product_toppings`. Các bảng `users`, `orders`, `order_items`, `order_item_toppings`, `payments` được thêm bằng migration mới ở Task 5.
- Chưa có `GET /health` và log JSON (NFR-07, thuộc phần vận hành ở Task 5).

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
# chép nhóm biến API trong .env.example ở gốc repo vào apps/api/.env, sửa DATABASE_URL
npm run prisma:migrate:deploy   # tạo bảng
npm run db:seed                 # nạp dữ liệu mẫu
npm run dev                     # http://localhost:3001
```

Thử nhanh:

```bash
curl http://localhost:3001/products
curl http://localhost:3001/products/c1b2c3d4-0000-4000-8000-000000000001
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
- Seed **chạy riêng**, không đặt trong lệnh start hay Dockerfile. Seed dùng id cố định và `upsert`, nên chạy lại không tạo trùng và không ghi đè tồn kho đã có.
- Ràng buộc `CHECK` tồn kho không âm, không giữ quá số tồn được thêm tay trong migration đầu tiên (backend-data-design §4.3), vì Prisma schema chưa khai báo được `CHECK`.

## Dữ liệu seed

| Món | Dùng để thử |
|---|---|
| Cà phê sữa, Trà sữa trân châu | Có size và topping |
| Trà đào cam sả (tồn = 0) | Nhãn hết hàng, `availableQuantity = 0` |
| Bạc xỉu, Nước suối | `imageUrl = null`; Nước suối không có size, topping |
| Sinh tố bơ (ngừng bán) | Không có trong danh sách, chi tiết trả `404` |
| Topping Pudding (ngừng bán) | Không hiện trong chi tiết món |
