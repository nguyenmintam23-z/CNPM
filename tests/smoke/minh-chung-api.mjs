// Chạy các luồng chính của BrewLite API và ghi minh chứng (Phân công Task 5, Duy: "ảnh/log chạy API,
// health endpoint hoạt động"). Dùng cho Docker Compose local đã seed, xem docs/minh-chung-api/README.md.
//
//   node tests/smoke/minh-chung-api.mjs --out docs/minh-chung-api/ket-qua.md
//
// Biến môi trường: API_BASE_URL (mặc định http://localhost:3001), SEED_STAFF_PASSWORD, SEED_MANAGER_PASSWORD
// (mật khẩu đã dùng khi seed). Chỉ dùng Node 18+, không cài thêm gói.
// Không ghi JWT hay mật khẩu vào kết quả: cookie chỉ giữ tên và thuộc tính.

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const BASE = opt('base', process.env.API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const OUT = opt('out', null);
const STAFF_PW = process.env.SEED_STAFF_PASSWORD ?? 'Staff@12345';
const MANAGER_PW = process.env.SEED_MANAGER_PASSWORD ?? 'Manager@12345';
const CHO_CHAM_MS = Number(process.env.PAYMENT_SIM_DELAY_MS ?? 5000) + 500;

// Id món trong prisma/seed.ts
const MON = {
  traSua: 'c1b2c3d4-0000-4000-8000-000000000002',
  traDaoHetHang: 'c1b2c3d4-0000-4000-8000-000000000003',
  nuocSuoi: 'c1b2c3d4-0000-4000-8000-000000000005',
};
const SIZE_M = 'a1b2c3d4-0000-4000-8000-000000000002';
const TRAN_CHAU = 'b1b2c3d4-0000-4000-8000-000000000001';

/** Cùng quy tắc với scenarioFor trong apps/api/src/payment/payment.service.ts, để chọn khóa ra đúng kịch bản. */
function kichBan(orderId, key) {
  const n = createHash('sha256').update(`${orderId}:${key}`).digest().readUInt32BE(0) % 100;
  if (n < 70) return 'SUCCESS';
  if (n < 90) return 'FAILURE';
  if (n < 95) return 'SLOW_SUCCESS';
  return 'SLOW_FAILURE';
}
const khoaCho = (orderId, sc) => { for (let i = 0; ; i++) { const k = `mc-${sc}-${i}-${randomUUID().slice(0, 8)}`; if (kichBan(orderId, k) === sc) return k; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function goi(method, path, { cookie, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* không phải JSON */ }
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') };
}

const buoc = [];
let soSai = 0;
/** Ghi một bước: yêu cầu, mã mong đợi, mã thực tế, phần body đáng xem. */
function ghi(nhom, moTa, yeuCau, mongDoi, r, tom, dieuKienThem = true) {
  const dung = (Array.isArray(mongDoi) ? mongDoi : [mongDoi]).includes(r.status) && dieuKienThem;
  if (!dung) soSai++;
  buoc.push({ nhom, moTa, yeuCau, mongDoi: [].concat(mongDoi).join('/'), thucTe: r.status, tom, dung });
}
const cookieCua = (r) => r.setCookie?.split(';')[0] ?? null;
/** Chỉ giữ tên và thuộc tính cookie, che giá trị JWT. */
const thuocTinhCookie = (sc) => (sc ? sc.replace(/=([^;]*)/, '=<đã che>') : '(không có)');

// ---------- 1. Health, bảo vệ API ----------
let r = await goi('GET', '/health');
ghi('Health', 'API và PostgreSQL sẵn sàng', 'GET /health', 200, r, JSON.stringify(r.json));
r = await goi('GET', '/products');
ghi('Xác thực', 'Chưa đăng nhập không xem được menu (FR-01, NFR-02)', 'GET /products', 401, r, r.json?.message);

// ---------- 2. Đăng ký, đăng nhập ----------
const email = `minh-chung-${Date.now()}@vd.vn`;
const matKhau = `Mc-${randomUUID().slice(0, 10)}`;
r = await goi('POST', '/auth/register', { body: { email, password: matKhau, fullName: 'Khách minh chứng' } });
ghi('Xác thực', 'Đăng ký tài khoản khách (FR-20)', 'POST /auth/register', 201, r, `role=${r.json?.role}; không đặt cookie: ${!r.setCookie}; không trả mật khẩu: ${!JSON.stringify(r.json).includes('password')}`, !r.setCookie);
r = await goi('POST', '/auth/login', { body: { email, password: 'sai-mat-khau' } });
ghi('Xác thực', 'Sai mật khẩu bị từ chối (FR-21)', 'POST /auth/login', 401, r, r.json?.message);
r = await goi('POST', '/auth/login', { body: { email, password: matKhau } });
const KHACH = cookieCua(r);
ghi('Xác thực', 'Đăng nhập, JWT trong cookie HttpOnly (ADR-001)', 'POST /auth/login', 200, r, `Set-Cookie: ${thuocTinhCookie(r.setCookie)}; body không có token: ${!JSON.stringify(r.json).toLowerCase().includes('token')}`, /HttpOnly/i.test(r.setCookie ?? ''));
r = await goi('GET', '/auth/me', { cookie: KHACH });
ghi('Xác thực', 'Đọc phiên hiện tại', 'GET /auth/me', 200, r, `role=${r.json?.role}, email=${r.json?.user?.email === email ? '(đúng tài khoản vừa tạo)' : '?'}`);

// ---------- 3. Menu ----------
r = await goi('GET', '/products', { cookie: KHACH });
ghi('Menu', 'Danh sách món, có món hết hàng (FR-01)', 'GET /products', 200, r, `${r.json?.length} món; ${r.json?.filter((p) => p.availableQuantity === 0).map((p) => p.name).join(', ')} có availableQuantity = 0`);
r = await goi('GET', `/products/${MON.traSua}`, { cookie: KHACH });
ghi('Menu', 'Chi tiết món, size và topping (FR-02, FR-03)', 'GET /products/:id', 200, r, `${r.json?.name}: ${r.json?.sizes?.length} size, ${r.json?.toppings?.length} topping`);

// ---------- 4. Tạo đơn ----------
const gio = [{ productId: MON.traSua, sizeId: SIZE_M, toppingIds: [TRAN_CHAU], quantity: 2 }];
const reqId = `mc-${randomUUID()}`;
r = await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: reqId, items: gio } });
const don1 = r.json;
ghi('Tạo đơn', 'Tạo đơn, giá tính ở server (FR-06)', 'POST /orders/checkout', 201, r, `${don1?.orderCode}: ${don1?.status}/${don1?.stockHoldStatus}, tổng ${don1?.totalAmount} đ`);
r = await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: reqId, items: gio } });
ghi('Tạo đơn', 'Gửi lại cùng requestId → trả đơn cũ, không tạo trùng (FR-18)', 'POST /orders/checkout', 200, r, `cùng mã đơn: ${r.json?.orderCode === don1?.orderCode}`, r.json?.id === don1?.id);
r = await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: `mc-${randomUUID()}`, items: [{ ...gio[0], totalAmount: 1 }] } });
ghi('Tạo đơn', 'Client gửi giá/tổng tiền → từ chối (FR-06, NFR-04)', 'POST /orders/checkout', 400, r, JSON.stringify(r.json?.message).slice(0, 120));
r = await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: `mc-${randomUUID()}`, items: [{ productId: MON.traDaoHetHang, sizeId: SIZE_M, quantity: 1 }] } });
ghi('Tạo đơn', 'Món hết hàng → 409 kèm món thiếu (FR-13, UC-01 E2)', 'POST /orders/checkout', 409, r, r.json?.shortages?.map((s) => s.message).join('; '));

// ---------- 5. Thanh toán ----------
r = await goi('POST', `/orders/${don1.id}/payments`, { cookie: KHACH, body: { method: 'CARD', idempotencyKey: khoaCho(don1.id, 'FAILURE') } });
ghi('Thanh toán', 'Thẻ mô phỏng thất bại → FAILED kèm lý do, đơn vẫn chờ (FR-14)', 'POST /orders/{id}/payments', 200, r, `${r.json?.payment?.status}: ${r.json?.payment?.failureReason}; đơn ${r.json?.order?.status}/${r.json?.order?.stockHoldStatus}`, r.json?.payment?.status === 'FAILED');
const khoaTC = khoaCho(don1.id, 'SUCCESS');
r = await goi('POST', `/orders/${don1.id}/payments`, { cookie: KHACH, body: { method: 'WALLET', idempotencyKey: khoaTC } });
ghi('Thanh toán', 'Thử lại bằng khóa mới, Ví thành công → đơn CONFIRMED (FR-07)', 'POST /orders/{id}/payments', 200, r, `${r.json?.payment?.status}; đơn ${r.json?.order?.orderCode} ${r.json?.order?.status}/${r.json?.order?.stockHoldStatus}`, r.json?.payment?.status === 'SUCCEEDED');
const idTra = r.json?.payment?.id;
r = await goi('POST', `/orders/${don1.id}/payments`, { cookie: KHACH, body: { method: 'WALLET', idempotencyKey: khoaTC } });
ghi('Thanh toán', 'Gửi lại cùng khóa → cùng kết quả, không trừ tiền lần hai (FR-15)', 'POST /orders/{id}/payments', 200, r, `cùng Payment: ${r.json?.payment?.id === idTra}`, r.json?.payment?.id === idTra);

const don2 = (await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: `mc-${randomUUID()}`, items: [{ productId: MON.nuocSuoi, quantity: 1 }] } })).json;
const khoaCham = khoaCho(don2.id, 'SLOW_SUCCESS');
r = await goi('POST', `/orders/${don2.id}/payments`, { cookie: KHACH, body: { method: 'WALLET', idempotencyKey: khoaCham } });
ghi('Thanh toán', 'Phản hồi chậm → 202 PROCESSING (UC-01 E6)', 'POST /orders/{id}/payments', 202, r, `${r.json?.payment?.status}`);
await sleep(CHO_CHAM_MS);
r = await goi('POST', `/orders/${don2.id}/payments`, { cookie: KHACH, body: { method: 'WALLET', idempotencyKey: khoaCham } });
ghi('Thanh toán', 'Gửi lại cùng khóa sau khi chờ → có kết quả cuối', 'POST /orders/{id}/payments', 200, r, `${r.json?.payment?.status}; đơn ${r.json?.order?.status}`, r.json?.payment?.status === 'SUCCEEDED');

// ---------- 6. Lịch sử, hủy đơn ----------
const don3 = (await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: `mc-${randomUUID()}`, items: [{ productId: MON.nuocSuoi, quantity: 1 }] } })).json;
r = await goi('GET', '/orders', { cookie: KHACH });
ghi('Đơn của khách', 'Lịch sử đơn của mình, mới nhất trước (FR-08)', 'GET /orders', 200, r, `${r.json?.total} đơn; đầu danh sách: ${r.json?.items?.[0]?.orderCode}`, r.json?.items?.[0]?.id === don3.id);
r = await goi('GET', `/orders/${don1.id}`, { cookie: KHACH });
ghi('Đơn của khách', 'Chi tiết đơn (FR-08)', 'GET /orders/:id', 200, r, `${r.json?.orderCode} ${r.json?.status}, ${r.json?.items?.length} dòng`);
r = await goi('POST', `/orders/${don3.id}/cancel`, { cookie: KHACH });
ghi('Đơn của khách', 'Hủy đơn chờ thanh toán, trả tồn (FR-23)', 'POST /orders/:id/cancel', 200, r, `${r.json?.status}/${r.json?.stockHoldStatus}`, r.json?.status === 'CANCELLED');
r = await goi('POST', `/orders/${don3.id}/payments`, { cookie: KHACH, body: { method: 'WALLET', idempotencyKey: `mc-${randomUUID()}` } });
ghi('Đơn của khách', 'Thanh toán đơn đã hủy → từ chối (FR-24)', 'POST /orders/{id}/payments', 409, r, r.json?.code);
r = await goi('POST', `/orders/${don1.id}/cancel`, { cookie: KHACH });
ghi('Đơn của khách', 'Hủy đơn đã xác nhận → từ chối (FR-23)', 'POST /orders/:id/cancel', 409, r, r.json?.code);

// ---------- 7. Nhân viên ----------
r = await goi('GET', '/staff/orders', { cookie: KHACH });
ghi('Nhân viên', 'Khách gọi API nhân viên → 403 (FR-17)', 'GET /staff/orders', 403, r, r.json?.message);
r = await goi('POST', '/auth/login', { body: { email: 'staff@brewlite.local', password: STAFF_PW } });
const NV = cookieCua(r);
ghi('Nhân viên', 'Nhân viên đăng nhập (tài khoản seed)', 'POST /auth/login', 200, r, `Set-Cookie: ${thuocTinhCookie(r.setCookie)}`);
r = await goi('GET', '/staff/orders', { cookie: NV });
ghi('Nhân viên', 'Hàng chờ chỉ có đơn đã thanh toán (FR-09)', 'GET /staff/orders', 200, r, `${r.json?.length} đơn; có ${don1.orderCode}: ${r.json?.some((o) => o.id === don1.id)}; có đơn đã hủy: ${r.json?.some((o) => o.id === don3.id)}`, r.json?.some((o) => o.id === don1.id) && !r.json?.some((o) => o.id === don3.id));
r = await goi('PATCH', `/staff/orders/${don1.id}/status`, { cookie: NV, body: { from: 'CONFIRMED', to: 'READY' } });
ghi('Nhân viên', 'Bỏ bước → 400 (FR-10)', 'PATCH /staff/orders/:id/status', 400, r, r.json?.code);
for (const [from, to] of [['CONFIRMED', 'PREPARING'], ['PREPARING', 'READY'], ['READY', 'COMPLETED']]) {
  r = await goi('PATCH', `/staff/orders/${don1.id}/status`, { cookie: NV, body: { from, to } });
  ghi('Nhân viên', `${from} → ${to} (FR-10)`, 'PATCH /staff/orders/:id/status', 200, r, r.json?.status, r.json?.status === to);
}
r = await goi('PATCH', `/staff/orders/${don2.id}/status`, { cookie: NV, body: { from: 'PREPARING', to: 'READY' } });
ghi('Nhân viên', 'Gửi trạng thái cũ (đơn còn CONFIRMED) → 409 kèm trạng thái mới nhất (FR-17)', 'PATCH /staff/orders/:id/status', 409, r, `${r.json?.code}; order.status=${r.json?.order?.status}`);
r = await goi('GET', `/orders/${don1.id}`, { cookie: KHACH });
ghi('Nhân viên', 'Khách mở lại đơn thấy trạng thái mới (FR-08)', 'GET /orders/:id', 200, r, r.json?.status, r.json?.status === 'COMPLETED');

// ---------- 8. Quản lý ----------
r = await goi('POST', '/auth/login', { body: { email: 'manager@brewlite.local', password: MANAGER_PW } });
const QL = cookieCua(r);
ghi('Quản lý', 'Quản lý đăng nhập (tài khoản seed)', 'POST /auth/login', 200, r, `Set-Cookie: ${thuocTinhCookie(r.setCookie)}`);
r = await goi('GET', '/manager/orders?status=CANCELLED', { cookie: QL });
ghi('Quản lý', 'Lọc đơn đã hủy (FR-11)', 'GET /manager/orders?status=CANCELLED', 200, r, `${r.json?.total} đơn, tất cả CANCELLED: ${r.json?.items?.every((o) => o.status === 'CANCELLED')}`, r.json?.items?.every((o) => o.status === 'CANCELLED'));
r = await goi('GET', `/manager/orders/${don1.id}`, { cookie: QL });
ghi('Quản lý', 'Chi tiết đơn có lần thanh toán thất bại (FR-11)', 'GET /manager/orders/:id', 200, r, r.json?.payments?.map((p) => `${p.method} ${p.status}${p.failureReason ? ` (${p.failureReason})` : ''}`).join(' → '));
r = await goi('PATCH', `/staff/orders/${don2.id}/status`, { cookie: QL, body: { from: 'CONFIRMED', to: 'PREPARING' } });
ghi('Quản lý', 'Quản lý không cập nhật tiến độ → 403', 'PATCH /staff/orders/:id/status', 403, r, r.json?.message);

// ---------- 9. Đăng xuất ----------
r = await goi('POST', '/auth/logout', { cookie: KHACH });
ghi('Xác thực', 'Đăng xuất (FR-21)', 'POST /auth/logout', 204, r, `Set-Cookie: ${thuocTinhCookie(r.setCookie)}`);
r = await goi('GET', '/auth/me', { cookie: KHACH });
ghi('Xác thực', 'JWT cũ sau đăng xuất bị từ chối (ADR-001)', 'GET /auth/me', 401, r, r.json?.message);

// ---------- Báo cáo ----------
const md = [
  '# Kết quả chạy các luồng API',
  '',
  `- Thời điểm: ${new Date().toISOString()}`,
  `- API: ${BASE}`,
  '- Script: `tests/smoke/minh-chung-api.mjs`. Giá trị cookie JWT đã che; mật khẩu không ghi ra.',
  '',
  '| # | Nhóm | Bước | Yêu cầu | Mong đợi | Thực tế | Ghi nhận | Đạt |',
  '|---|---|---|---|---|---|---|---|',
  ...buoc.map((b, i) => `| ${i + 1} | ${b.nhom} | ${b.moTa} | \`${b.yeuCau}\` | ${b.mongDoi} | ${b.thucTe} | ${String(b.tom ?? '').replace(/\|/g, '\\|')} | ${b.dung ? 'Đạt' : '**Sai**'} |`),
  '',
  `**Tổng:** ${buoc.length - soSai}/${buoc.length} bước đạt.`,
  '',
].join('\n');
console.log(md);
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md, 'utf8');
  console.log(`Đã ghi ${OUT}`);
}
process.exit(soSai ? 1 : 0);
