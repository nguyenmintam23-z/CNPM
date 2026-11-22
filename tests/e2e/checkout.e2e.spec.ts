import { expect, type Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Luồng khách hàng trên BrewLite Web (đề 7.2: menu → chọn tùy chọn → giỏ hàng → đặt đơn → thanh toán → xác nhận;
 * UC-01; NFR-05: đi hết luồng xem menu → đặt đơn → thanh toán → theo dõi đơn ở 375 px, không cuộn ngang).
 *
 * Dữ liệu: seed của apps/api/prisma/seed.ts (Trà sữa trân châu 35.000 ₫, size L +10.000 ₫, Trân châu +7.000 ₫).
 * Thanh toán mô phỏng chọn kết quả theo đơn và khóa giao dịch (FR-07), image API chạy production nên không ép được
 * kết quả. Test làm như người dùng: thất bại thì thử lần mới (FR-14), đang xử lý thì chờ rồi kiểm tra lại (FR-15).
 */

const ANH = process.env.E2E_EVIDENCE_DIR; // đặt thì lưu ảnh từng bước vào thư mục này làm minh chứng
let soAnh = 0;

async function chup(page: Page, ten: string) {
  if (!ANH) return;
  mkdirSync(ANH, { recursive: true });
  soAnh += 1;
  await page.screenshot({ path: join(ANH, `${String(soAnh).padStart(2, '0')}-${ten}.png`), fullPage: true });
}

/** NFR-05: trang không rộng hơn màn hình, tức không phải cuộn ngang. */
async function khongCuonNgang(page: Page) {
  const { rong, manHinh } = await page.evaluate(() => ({
    rong: document.documentElement.scrollWidth,
    manHinh: window.innerWidth,
  }));
  expect(rong, `trang rộng ${rong}px trên màn hình ${manHinh}px`).toBeLessThanOrEqual(manHinh);
}

test('khách đặt trà sữa, thanh toán và theo dõi đơn trên màn hình 375 px', async ({ page }) => {
  const email = `e2e-${Date.now()}@vd.vn`;
  const matKhau = `E2e-${Date.now()}`;
  let maDon = '';

  await test.step('Đăng ký rồi đăng nhập (FR-20, FR-21)', async () => {
    await page.goto('/register');
    await page.getByLabel('Họ và tên').fill('Khách E2E');
    await page.getByLabel('Địa chỉ email').fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(matKhau);
    await page.getByLabel('Xác nhận mật khẩu').fill(matKhau);
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Đăng nhập', level: 1 })).toBeVisible();
    // Lúc chuyển trang, form đăng ký cũ có thể còn trong DOM: chỉ lấy ô đang hiển thị.
    await page.getByLabel('Địa chỉ email').filter({ visible: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).filter({ visible: true }).fill(matKhau);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(/\/$|\/#menu$/);
  });

  await test.step('Xem menu: có món đang bán và món hết hàng (FR-01)', async () => {
    await expect(page.getByRole('heading', { name: 'Thực đơn BrewLite' })).toBeVisible();
    const traSua = page.getByRole('link', { name: 'Xem chi tiết Trà sữa trân châu' });
    await expect(traSua).toContainText('35.000 ₫');
    await expect(page.getByRole('link', { name: 'Xem chi tiết Trà đào cam sả' })).toContainText('Hết hàng');
    await khongCuonNgang(page);
    await chup(page, 'menu');
    await traSua.click();
  });

  await test.step('Chọn size L, topping Trân châu, số lượng 2; giá tạm tính cập nhật (FR-02, FR-03)', async () => {
    await expect(page.getByRole('heading', { name: 'Trà sữa trân châu', level: 1 })).toBeVisible();
    await page.getByText('L (+10.000 ₫)').click();
    await page.getByRole('checkbox', { name: /^Trân châu/ }).check();
    await page.getByRole('button', { name: 'Tăng số lượng' }).click();
    await expect(page.getByText('Tạm tính')).toBeVisible();
    await expect(page.getByText('104.000 ₫')).toBeVisible(); // (35.000 + 10.000 + 7.000) × 2
    await khongCuonNgang(page);
    await chup(page, 'chi-tiet-mon');
    await page.getByRole('button', { name: 'Thêm vào giỏ hàng' }).click();
  });

  await test.step('Giỏ hàng giữ đúng lựa chọn và tổng tạm tính (FR-04)', async () => {
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.getByRole('status').filter({ hasText: 'Đã thêm món vào giỏ hàng.' })).toBeVisible();
    const dong = page.getByRole('region', { name: 'Các món trong giỏ' }).getByRole('article');
    await expect(dong).toHaveCount(1);
    await expect(dong).toContainText('Size: L');
    await expect(dong).toContainText('Topping: Trân châu');
    await expect(dong).toContainText('Đơn giá: 52.000 ₫');
    await expect(dong.getByRole('status')).toHaveText('2');
    await expect(page.getByRole('complementary')).toContainText('104.000 ₫');
    await khongCuonNgang(page);
    await chup(page, 'gio-hang');
    await page.getByRole('link', { name: 'Tiếp tục đặt đơn' }).click();
  });

  await test.step('Đặt đơn: server tạo đơn chờ thanh toán, tổng tiền khớp (FR-06)', async () => {
    await expect(page.getByRole('heading', { name: 'Xác nhận đặt đơn', level: 1 })).toBeVisible();
    await khongCuonNgang(page);
    await chup(page, 'xac-nhan-dat-don');
    await page.getByRole('button', { name: 'Xác nhận đặt đơn' }).click();
    const don = page.getByRole('region', { name: 'Đơn hàng đã tạo' });
    await expect(don).toContainText('Chờ thanh toán');
    await expect(don).toContainText(/Tổng tiền\s*104\.000\s₫/); // số tiền định dạng có dấu cách không ngắt
    const tieuDe = await don.getByRole('heading', { name: /^Mã đơn: BL-/ }).textContent();
    maDon = (tieuDe ?? '').replace('Mã đơn:', '').trim();
    expect(maDon).toMatch(/^BL-\d{6}-[A-Z0-9]{5}$/);
    await khongCuonNgang(page);
    await chup(page, 'da-tao-don');
  });

  await test.step('Thanh toán Ví mô phỏng đến khi thành công (FR-07, FR-14, FR-15)', async () => {
    const tt = page.getByRole('region', { name: 'Thanh toán mô phỏng' });
    await expect(tt.getByRole('button', { name: 'Ví điện tử mô phỏng' })).toHaveAttribute('aria-pressed', 'true');
    const thanhCong = tt.getByText('Thanh toán mô phỏng thành công!');
    const nut = tt.getByRole('button', { name: /Xác nhận thanh toán mô phỏng|Thử thanh toán lần mới|Kiểm tra lại kết quả/ });
    const daBam: string[] = [];
    for (let lan = 0; lan < 10 && !(await thanhCong.isVisible()); lan++) {
      await expect(thanhCong.or(nut)).toBeVisible();
      if (await thanhCong.isVisible()) break;
      const ten = (await nut.textContent())?.trim() ?? '';
      daBam.push(ten);
      if (ten === 'Kiểm tra lại kết quả') await page.waitForTimeout(5_500); // phản hồi chậm mặc định 5 giây
      await nut.click();
      await expect(tt.getByRole('button', { name: 'Đang xử lý...' })).toHaveCount(0);
    }
    test.info().annotations.push({ type: 'thanh-toan', description: daBam.join(' → ') });
    await expect(thanhCong).toBeVisible();
    await expect(tt).toContainText(`Đơn ${maDon} đã thanh toán thành công`);
    await expect(page.getByRole('region', { name: 'Đơn hàng đã tạo' })).toContainText('Trạng thái: Đã xác nhận');
    await khongCuonNgang(page);
    await chup(page, 'thanh-toan-thanh-cong');
  });

  await test.step('Giỏ hàng trống sau khi thanh toán thành công', async () => {
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Giỏ hàng đang trống' })).toBeVisible();
    await khongCuonNgang(page);
  });

  await test.step('Theo dõi đơn trong "Đơn hàng của tôi" (FR-08)', async () => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Đơn hàng của tôi' }).click();
    await expect(page.getByRole('heading', { name: 'Đơn hàng của tôi', level: 1 })).toBeVisible();
    const hang = page.getByRole('row').filter({ hasText: maDon });
    await expect(hang).toContainText('Đã xác nhận');
    await expect(hang).toContainText('104.000 ₫');
    await khongCuonNgang(page);
    await chup(page, 'don-hang-cua-toi');
    await hang.getByRole('link', { name: 'Xem đơn' }).click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
    await expect(page.getByText(maDon).first()).toBeVisible();
    await expect(page.getByText('Đã xác nhận').first()).toBeVisible();
    await khongCuonNgang(page);
    await chup(page, 'chi-tiet-don');
  });
});
