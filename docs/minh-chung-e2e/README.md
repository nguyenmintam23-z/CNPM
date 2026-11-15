# Minh chứng E2E: menu → giỏ hàng → đặt đơn → thanh toán → theo dõi đơn

**Yêu cầu**
- Đề 7.2 và mục 9: ít nhất một E2E test tự động menu → chọn tùy chọn → giỏ hàng → đặt đơn → thanh toán → xác nhận.
- Phân công Task 5: chạy E2E trên môi trường tích hợp, lưu log/screenshot.
- Issue #37 (NFR-05): đi hết luồng xem menu → đặt đơn → thanh toán → theo dõi đơn trên màn hình rộng 375 px mà không phải cuộn ngang.

Test: [`tests/e2e/checkout.e2e.spec.ts`](../../tests/e2e/checkout.e2e.spec.ts), Playwright 1.64.1, trình duyệt Chromium, màn hình 375 × 812.

## Kết quả lần chạy 15/11/2026

Chạy trên Docker Compose local (web, API, PostgreSQL thật, không giả lập), database trống rồi seed, `main` commit `288eb77`. **Đạt.** Nhật ký: [`lan-chay.txt`](lan-chay.txt).

| # | Bước | Kiểm tra | Ảnh |
|---|---|---|---|
| 1 | Đăng ký, đăng nhập | Tạo tài khoản khách mới qua giao diện, chuyển về đăng nhập, vào được menu | |
| 2 | Xem menu | Có "Thực đơn BrewLite", Trà sữa trân châu 35.000 ₫, Trà đào cam sả nhãn "Hết hàng" (FR-01) | [01](anh/01-menu.png) |
| 3 | Chọn tùy chọn | Size L, topping Trân châu, số lượng 2; tạm tính 104.000 ₫ (FR-02, FR-03) | [02](anh/02-chi-tiet-mon.png) |
| 4 | Giỏ hàng | Thông báo đã thêm; 1 dòng Size L, Trân châu, đơn giá 52.000 ₫, số lượng 2, tạm tính 104.000 ₫ (FR-04) | [03](anh/03-gio-hang.png) |
| 5 | Đặt đơn | Màn hình xác nhận; tạo đơn "Chờ thanh toán", mã `BL-yyMMdd-XXXXX`, tổng tiền server xác nhận 104.000 ₫ (FR-06) | [04](anh/04-xac-nhan-dat-don.png), [05](anh/05-da-tao-don.png) |
| 6 | Thanh toán | Ví mô phỏng đến khi "Thanh toán mô phỏng thành công!", đơn "Đã xác nhận" (FR-07, FR-14, FR-15) | [06](anh/06-thanh-toan-thanh-cong.png) |
| 7 | Theo dõi đơn | "Đơn hàng của tôi" có đúng mã đơn, "Đã xác nhận", 104.000 ₫; mở chi tiết đơn (FR-08) | [07](anh/07-don-hang-cua-toi.png), [08](anh/08-chi-tiet-don.png) |

Ở mỗi bước có ảnh, test kiểm trang không rộng hơn 375 px, tức không phải cuộn ngang (NFR-05).

## Thanh toán có kết quả ngẫu nhiên

Bộ mô phỏng chọn kết quả theo đơn và khóa giao dịch (70% thành công, 20% thất bại, 10% chậm), và image API chạy `NODE_ENV=production` nên không ép được kết quả (`PAYMENT_SIM_SCENARIO` chỉ dùng ngoài production). Test làm như người dùng: thất bại thì bấm "Thử thanh toán lần mới" (khóa mới, FR-14), đang xử lý thì chờ rồi bấm "Kiểm tra lại kết quả" (cùng khóa, FR-15), tối đa 10 lần.

Để chắc các nhánh này chạy đúng, test được chạy lặp 8 lần liên tiếp trên cùng database (`--repeat-each=8`): **8/8 đạt**, không lần nào chập chờn.

| Lần | Thời gian | Các nút đã bấm ở bước thanh toán |
|---|---|---|
| 1 | 6,9 s | Xác nhận thanh toán → Thử lần mới (lần đầu thất bại) |
| 2 | 4,8 s | Xác nhận thanh toán |
| 3 | 5,0 s | Xác nhận thanh toán |
| 4 | 10,6 s | Xác nhận thanh toán → Kiểm tra lại kết quả (chậm rồi thất bại) → Thử lần mới |
| 5 | 4,7 s | Xác nhận thanh toán |
| 6 | 5,8 s | Xác nhận thanh toán |
| 7 | 4,1 s | Xác nhận thanh toán |
| 8 | 4,4 s | Xác nhận thanh toán |

## Chạy lại

Dùng project Compose riêng để không đụng database dev (giống `docs/minh-chung-p95`):

```bash
docker compose stop
docker compose -p brewlite-e2e down -v
docker compose -p brewlite-e2e up --build -d
docker compose -p brewlite-e2e exec -e SEED_STAFF_PASSWORD='Staff@12345' -e SEED_MANAGER_PASSWORD='Manager@12345' api npx prisma db seed
cd tests/e2e
npm ci
npx playwright install chromium
npx playwright test
```

- Lưu ảnh minh chứng: đặt `E2E_EVIDENCE_DIR=../../docs/minh-chung-e2e/anh` trước `npx playwright test`.
- Báo cáo HTML và trace của mỗi lần chạy nằm ở `tests/e2e/playwright-report/` và `tests/e2e/test-results/` (không commit). Xem trace: `npx playwright show-trace test-results/<thư mục>/trace.zip`.
- Chạy ở địa chỉ khác: đặt `E2E_BASE_URL`. Test tạo một tài khoản và một đơn mới mỗi lần chạy, nên chỉ chạy trên production khi nhóm đồng ý.
- Dọn: `docker compose -p brewlite-e2e down -v`, rồi `docker compose up -d` để bật lại dev.
