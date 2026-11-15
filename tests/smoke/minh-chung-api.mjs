// Chạy các luồng chính của BrewLite API và ghi minh chứng (Phân công Task 5, Duy: "ảnh/log chạy API,
// health endpoint hoạt động"). Dùng cho Docker Compose local đã seed, xem docs/minh-chung-api/README.md.
//
//   node tests/smoke/minh-chung-api.mjs --out docs/minh-chung-api/ket-qua.md
//
// Biến môi trường: API_BASE_URL (mặc định http://localhost:3001); bắt buộc SEED_STAFF_PASSWORD, SEED_MANAGER_PASSWORD
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
// Mật khẩu tài khoản nội bộ phải trùng giá trị đã dùng khi seed; không ghi sẵn mật khẩu trong mã nguồn.
const STAFF_PW = process.env.SEED_STAFF_PASSWORD;
const MANAGER_PW = process.env.SEED_MANAGER_PASSWORD;
if (!STAFF_PW || !MANAGER_PW) {
  console.error('Dừng: đặt SEED_STAFF_PASSWORD và SEED_MANAGER_PASSWORD bằng mật khẩu đã dùng khi seed.');
  process.exit(2);
}
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
// Mỗi bước chỉ "Đạt" khi đúng mã HTTP VÀ đúng điều kiện nghiệp vụ ghi trong tên bước.
let r = await goi('GET', '/health');
ghi('Health', 'API và PostgreSQL sẵn sàng', 'GET /health', 200, r, JSON.stringify(r.json), r.json?.status === 'ok');
r = await goi('GET', '/products');
ghi('Xác thực', 'Chưa đăng nhập không xem được menu (FR-01, NFR-02)', 'GET /products', 401, r, r.json?.message, !Array.isArray(r.json));

// ---------- 2. Đăng ký, đăng nhập ----------
const email = `minh-chung-${Date.now()}@vd.vn`;
const matKhau = `Mc-${randomUUID().slice(0, 10)}`;
r = await goi('POST', '/auth/register', { body: { email, password: matKhau, fullName: 'Khách minh chứng' } });
const khongLoMk = !JSON.stringify(r.json ?? {}).toLowerCase().includes('password');
ghi('Xác thực', 'Đăng ký tài khoản khách: vai trò CUSTOMER, không đặt cookie, không trả mật khẩu (FR-20)', 'POST /auth/register', 201, r,
  `role=${r.json?.role}; không đặt cookie: ${!r.setCookie}; không trả mật khẩu: ${khongLoMk}`, r.json?.role === 'CUSTOMER' && !r.setCookie && khongLoMk);
r = await goi('POST', '/auth/login', { body: { email, password: 'sai-mat-khau' } });
ghi('Xác thực', 'Sai mật khẩu bị từ chối, không đặt cookie (FR-21)', 'POST /auth/login', 401, r, r.json?.message, !r.setCookie);
r = await goi('POST', '/auth/login', { body: { email, password: matKhau } });
const KHACH = cookieCua(r);
const sc = r.setCookie ?? '';
const coToken = JSON.stringify(r.json ?? {}).toLowerCase().includes('token');
ghi('Xác thực', 'Đăng nhập: JWT trong cookie HttpOnly, SameSite=Lax, 30 phút; body không có token (ADR-001)', 'POST /auth/login', 200, r,
  `Set-Cookie: ${thuocTinhCookie(r.setCookie)}; body có token: ${coToken}`,
  /^brewlite_session=/.test(sc) && /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc) && /Max-Age=1800/i.test(sc) && !coToken);
r = await goi('GET', '/auth/me', { cookie: KHACH });
ghi('Xác thực', 'Đọc phiên hiện tại: đúng tài khoản vừa đăng nhập', 'GET /auth/me', 200, r,
  `role=${r.json?.role}, đúng email vừa đăng ký: ${r.json?.user?.email === email}`, r.json?.role === 'CUSTOMER' && r.json?.user?.email === email);

// ---------- 3. Menu ----------
r = await goi('GET', '/products', { cookie: KHACH });
const hetHang = Array.isArray(r.json) ? r.json.filter((p) => p.availableQuantity === 0) : [];
ghi('Menu', 'Danh sách món, món hết hàng vẫn hiện với availableQuantity = 0 (FR-01)', 'GET /products', 200, r,
  `${r.json?.length} món; hết hàng: ${hetHang.map((p) => p.name).join(', ')}`, Array.isArray(r.json) && hetHang.some((p) => p.id === MON.traDaoHetHang));
r = await goi('GET', `/products/${MON.traSua}`, { cookie: KHACH });
const chiTiet = r.json;
const sizeM = chiTiet?.sizes?.find((s) => s.id === SIZE_M);
const tcTopping = chiTiet?.toppings?.find((t) => t.id === TRAN_CHAU);
ghi('Menu', 'Chi tiết món có size và topping (FR-02, FR-03)', 'GET /products/:id', 200, r,
  `${chiTiet?.name}: ${chiTiet?.sizes?.length} size, ${chiTiet?.toppings?.length} topping`, chiTiet?.id === MON.traSua && !!sizeM && !!tcTopping);

// ---------- 4. Tạo đơn ----------
const gio = [{ productId: MON.traSua, sizeId: SIZE_M, toppingIds: [TRAN_CHAU], quantity: 2 }];
// Tổng mong đợi tính từ giá trong GET /products/:id: (giá gốc + size M + trân châu) × 2
const tongMongDoi = ((chiTiet?.basePrice ?? NaN) + (sizeM?.extraPrice ?? NaN) + (tcTopping?.price ?? NaN)) * 2;
const reqId = `mc-${randomUUID()}`;
r = await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: reqId, items: gio } });
const don1 = r.json;
ghi('Tạo đơn', 'Tạo đơn PENDING_PAYMENT/HELD, tổng tiền tính ở server khớp giá menu (FR-06)', 'POST /orders/checkout', 201, r,
  `${don1?.orderCode}: ${don1?.status}/${don1?.stockHoldStatus}, tổng ${don1?.totalAmount} đ (mong đợi ${tongMongDoi} đ)`,
  don1?.status === 'PENDING_PAYMENT' && don1?.stockHoldStatus === 'HELD' && don1?.totalAmount === tongMongDoi);
r = await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: reqId, items: gio } });
ghi('Tạo đơn', 'Gửi lại cùng requestId → trả đơn cũ, không tạo trùng (FR-18)', 'POST /orders/checkout', 200, r, `cùng đơn: ${r.json?.id === don1?.id}`, r.json?.id === don1?.id);
r = await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: `mc-${randomUUID()}`, items: [{ ...gio[0], totalAmount: 1 }] } });
ghi('Tạo đơn', 'Client gửi giá/tổng tiền → từ chối trường totalAmount (FR-06, NFR-04)', 'POST /orders/checkout', 400, r,
  JSON.stringify(r.json?.message).slice(0, 120), JSON.stringify(r.json?.message ?? '').includes('totalAmount'));
r = await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: `mc-${randomUUID()}`, items: [{ productId: MON.traDaoHetHang, sizeId: SIZE_M, quantity: 1 }] } });
ghi('Tạo đơn', 'Món hết hàng → 409 kèm đúng món thiếu (FR-13, UC-01 E2)', 'POST /orders/checkout', 409, r,
  r.json?.shortages?.map((s) => s.message).join('; '), r.json?.shortages?.some((s) => s.productId === MON.traDaoHetHang && s.available === 0));

// ---------- 5. Thanh toán ----------
r = await goi('POST', `/orders/${don1.id}/payments`, { cookie: KHACH, body: { method: 'CARD', idempotencyKey: khoaCho(don1.id, 'FAILURE') } });
let p = r.json?.payment; let o = r.json?.order;
ghi('Thanh toán', 'Thẻ mô phỏng thất bại → FAILED kèm lý do; đơn vẫn PENDING_PAYMENT, tồn RELEASED (FR-14)', 'POST /orders/{id}/payments', 200, r,
  `${p?.status}: ${p?.failureReason}; đơn ${o?.status}/${o?.stockHoldStatus}`,
  p?.status === 'FAILED' && !!p?.failureReason && o?.status === 'PENDING_PAYMENT' && o?.stockHoldStatus === 'RELEASED');
const khoaTC = khoaCho(don1.id, 'SUCCESS');
r = await goi('POST', `/orders/${don1.id}/payments`, { cookie: KHACH, body: { method: 'WALLET', idempotencyKey: khoaTC } });
p = r.json?.payment; o = r.json?.order;
ghi('Thanh toán', 'Thử lại bằng khóa mới, Ví thành công → SUCCEEDED; đơn CONFIRMED, tồn COMMITTED, cùng mã đơn (FR-07, FR-14)', 'POST /orders/{id}/payments', 200, r,
  `${p?.status}; đơn ${o?.orderCode} ${o?.status}/${o?.stockHoldStatus}; số tiền ${p?.amount} đ`,
  p?.status === 'SUCCEEDED' && o?.status === 'CONFIRMED' && o?.stockHoldStatus === 'COMMITTED' && o?.orderCode === don1.orderCode && p?.amount === don1.totalAmount);
const idTra = p?.id;
r = await goi('POST', `/orders/${don1.id}/payments`, { cookie: KHACH, body: { method: 'WALLET', idempotencyKey: khoaTC } });
ghi('Thanh toán', 'Gửi lại cùng khóa → cùng Payment, vẫn SUCCEEDED (FR-15)', 'POST /orders/{id}/payments', 200, r,
  `cùng Payment: ${r.json?.payment?.id === idTra}; ${r.json?.payment?.status}`, !!idTra && r.json?.payment?.id === idTra && r.json?.payment?.status === 'SUCCEEDED');

const don2 = (await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: `mc-${randomUUID()}`, items: [{ productId: MON.nuocSuoi, quantity: 1 }] } })).json;
const khoaCham = khoaCho(don2.id, 'SLOW_SUCCESS');
r = await goi('POST', `/orders/${don2.id}/payments`, { cookie: KHACH, body: { method: 'WALLET', idempotencyKey: khoaCham } });
ghi('Thanh toán', 'Phản hồi chậm → 202 PROCESSING, đơn vẫn chờ (UC-01 E6)', 'POST /orders/{id}/payments', 202, r,
  `${r.json?.payment?.status}; đơn ${r.json?.order?.status}`, r.json?.payment?.status === 'PROCESSING' && r.json?.order?.status === 'PENDING_PAYMENT');
const idCham = r.json?.payment?.id;
await sleep(CHO_CHAM_MS);
r = await goi('POST', `/orders/${don2.id}/payments`, { cookie: KHACH, body: { method: 'WALLET', idempotencyKey: khoaCham } });
ghi('Thanh toán', 'Gửi lại cùng khóa sau khi chờ → cùng Payment có kết quả cuối SUCCEEDED, đơn CONFIRMED', 'POST /orders/{id}/payments', 200, r,
  `${r.json?.payment?.status}; cùng Payment: ${r.json?.payment?.id === idCham}; đơn ${r.json?.order?.status}`,
  r.json?.payment?.status === 'SUCCEEDED' && r.json?.payment?.id === idCham && r.json?.order?.status === 'CONFIRMED');

// ---------- 6. Lịch sử, hủy đơn ----------
const conNuocSuoi = async () => (await goi('GET', `/products/${MON.nuocSuoi}`, { cookie: KHACH })).json?.availableQuantity;
const truocKhiDat = await conNuocSuoi();
const don3 = (await goi('POST', '/orders/checkout', { cookie: KHACH, body: { requestId: `mc-${randomUUID()}`, items: [{ productId: MON.nuocSuoi, quantity: 1 }] } })).json;
r = await goi('GET', '/orders', { cookie: KHACH });
const idsLichSu = r.json?.items?.map((x) => x.id) ?? [];
ghi('Đơn của khách', 'Lịch sử chỉ có đơn của mình, mới nhất trước (FR-08)', 'GET /orders', 200, r,
  `${r.json?.total} đơn; đầu danh sách: ${r.json?.items?.[0]?.orderCode}`,
  r.json?.total === 3 && idsLichSu[0] === don3.id && [don1.id, don2.id, don3.id].every((id) => idsLichSu.includes(id)));
r = await goi('GET', `/orders/${don1.id}`, { cookie: KHACH });
ghi('Đơn của khách', 'Chi tiết đơn đã thanh toán: CONFIRMED, đủ dòng món (FR-08)', 'GET /orders/:id', 200, r,
  `${r.json?.orderCode} ${r.json?.status}, ${r.json?.items?.length} dòng`, r.json?.id === don1.id && r.json?.status === 'CONFIRMED' && r.json?.items?.length === 1);
const truocKhiHuy = await conNuocSuoi();
r = await goi('POST', `/orders/${don3.id}/cancel`, { cookie: KHACH });
const sauKhiHuy = await conNuocSuoi();
ghi('Đơn của khách', 'Hủy đơn chờ thanh toán → CANCELLED/RELEASED, tồn trả lại đúng 1 ly (FR-23)', 'POST /orders/:id/cancel', 200, r,
  `${r.json?.status}/${r.json?.stockHoldStatus}; Nước suối còn bán: ${truocKhiDat} → ${truocKhiHuy} (đặt) → ${sauKhiHuy} (hủy)`,
  r.json?.status === 'CANCELLED' && r.json?.stockHoldStatus === 'RELEASED' && truocKhiHuy === truocKhiDat - 1 && sauKhiHuy === truocKhiDat);
r = await goi('POST', `/orders/${don3.id}/payments`, { cookie: KHACH, body: { method: 'WALLET', idempotencyKey: `mc-${randomUUID()}` } });
ghi('Đơn của khách', 'Thanh toán đơn đã hủy → 409 ORDER_NOT_PAYABLE (FR-24)', 'POST /orders/{id}/payments', 409, r, r.json?.code, r.json?.code === 'ORDER_NOT_PAYABLE');
r = await goi('POST', `/orders/${don1.id}/cancel`, { cookie: KHACH });
ghi('Đơn của khách', 'Hủy đơn đã xác nhận → 409 ORDER_NOT_CANCELLABLE (FR-23)', 'POST /orders/:id/cancel', 409, r, r.json?.code, r.json?.code === 'ORDER_NOT_CANCELLABLE');

// ---------- 7. Nhân viên ----------
r = await goi('GET', '/staff/orders', { cookie: KHACH });
ghi('Nhân viên', 'Khách gọi API nhân viên → 403 (FR-17)', 'GET /staff/orders', 403, r, r.json?.message, !Array.isArray(r.json));
r = await goi('POST', '/auth/login', { body: { email: 'staff@brewlite.local', password: STAFF_PW } });
const NV = cookieCua(r);
ghi('Nhân viên', 'Nhân viên đăng nhập (tài khoản seed)', 'POST /auth/login', 200, r, `Set-Cookie: ${thuocTinhCookie(r.setCookie)}; role=${r.json?.role}`, !!NV && r.json?.role === 'STAFF');
r = await goi('GET', '/staff/orders', { cookie: NV });
const hc = Array.isArray(r.json) ? r.json : [];
ghi('Nhân viên', 'Hàng chờ có 2 đơn đã thanh toán, không có đơn đã hủy (FR-09, FR-24)', 'GET /staff/orders', 200, r,
  `${hc.length} đơn: ${hc.map((x) => `${x.orderCode} ${x.status}`).join(', ')}`,
  hc.length === 2 && hc.some((x) => x.id === don1.id) && hc.some((x) => x.id === don2.id) && !hc.some((x) => x.id === don3.id) && hc.every((x) => x.status === 'CONFIRMED'));
r = await goi('PATCH', `/staff/orders/${don1.id}/status`, { cookie: NV, body: { from: 'CONFIRMED', to: 'READY' } });
ghi('Nhân viên', 'Bỏ bước → 400 INVALID_TRANSITION (FR-10)', 'PATCH /staff/orders/:id/status', 400, r, r.json?.code, r.json?.code === 'INVALID_TRANSITION');
for (const [from, to] of [['CONFIRMED', 'PREPARING'], ['PREPARING', 'READY'], ['READY', 'COMPLETED']]) {
  r = await goi('PATCH', `/staff/orders/${don1.id}/status`, { cookie: NV, body: { from, to } });
  ghi('Nhân viên', `${from} → ${to} (FR-10)`, 'PATCH /staff/orders/:id/status', 200, r, r.json?.status, r.json?.id === don1.id && r.json?.status === to);
}
r = await goi('PATCH', `/staff/orders/${don2.id}/status`, { cookie: NV, body: { from: 'PREPARING', to: 'READY' } });
ghi('Nhân viên', 'Gửi trạng thái cũ (đơn còn CONFIRMED) → 409 ORDER_STATUS_CHANGED kèm trạng thái mới nhất (FR-17)', 'PATCH /staff/orders/:id/status', 409, r,
  `${r.json?.code}; order.status=${r.json?.order?.status}`, r.json?.code === 'ORDER_STATUS_CHANGED' && r.json?.order?.id === don2.id && r.json?.order?.status === 'CONFIRMED');
r = await goi('GET', `/orders/${don1.id}`, { cookie: KHACH });
ghi('Nhân viên', 'Khách mở lại đơn thấy COMPLETED (FR-08)', 'GET /orders/:id', 200, r, r.json?.status, r.json?.status === 'COMPLETED');

// ---------- 8. Quản lý ----------
r = await goi('POST', '/auth/login', { body: { email: 'manager@brewlite.local', password: MANAGER_PW } });
const QL = cookieCua(r);
ghi('Quản lý', 'Quản lý đăng nhập (tài khoản seed)', 'POST /auth/login', 200, r, `Set-Cookie: ${thuocTinhCookie(r.setCookie)}; role=${r.json?.role}`, !!QL && r.json?.role === 'MANAGER');
r = await goi('GET', '/manager/orders?status=CANCELLED', { cookie: QL });
const dsHuy = r.json?.items ?? [];
ghi('Quản lý', 'Lọc Đã hủy: có đúng đơn vừa hủy, mọi đơn đều CANCELLED (FR-11)', 'GET /manager/orders?status=CANCELLED', 200, r,
  `${r.json?.total} đơn; có ${don3.orderCode}: ${dsHuy.some((x) => x.id === don3.id)}; tất cả CANCELLED: ${dsHuy.length > 0 && dsHuy.every((x) => x.status === 'CANCELLED')}`,
  dsHuy.some((x) => x.id === don3.id) && dsHuy.every((x) => x.status === 'CANCELLED'));
r = await goi('GET', `/manager/orders/${don1.id}`, { cookie: QL });
const tt = r.json?.payments ?? [];
ghi('Quản lý', 'Chi tiết đơn thấy lần Thẻ FAILED kèm lý do, rồi lần Ví SUCCEEDED (FR-11)', 'GET /manager/orders/:id', 200, r,
  tt.map((x) => `${x.method} ${x.status}${x.failureReason ? ` (${x.failureReason})` : ''}`).join(' → '),
  tt.length === 2 && tt[0].method === 'CARD' && tt[0].status === 'FAILED' && !!tt[0].failureReason && tt[1].method === 'WALLET' && tt[1].status === 'SUCCEEDED');
r = await goi('PATCH', `/staff/orders/${don2.id}/status`, { cookie: QL, body: { from: 'CONFIRMED', to: 'PREPARING' } });
const sauQL = (await goi('GET', `/manager/orders/${don2.id}`, { cookie: QL })).json?.status;
ghi('Quản lý', 'Quản lý không cập nhật tiến độ → 403, đơn vẫn CONFIRMED', 'PATCH /staff/orders/:id/status', 403, r, `${r.json?.message}; đơn sau đó: ${sauQL}`, sauQL === 'CONFIRMED');

// ---------- 9. Đăng xuất ----------
r = await goi('POST', '/auth/logout', { cookie: KHACH });
ghi('Xác thực', 'Đăng xuất xóa cookie (FR-21)', 'POST /auth/logout', 204, r, `Set-Cookie: ${thuocTinhCookie(r.setCookie)}`,
  /^brewlite_session=;/.test(r.setCookie ?? '') || /Expires=Thu, 01 Jan 1970/i.test(r.setCookie ?? ''));
r = await goi('GET', '/auth/me', { cookie: KHACH });
ghi('Xác thực', 'JWT cũ sau đăng xuất bị từ chối (ADR-001)', 'GET /auth/me', 401, r, r.json?.message, !r.json?.user);

// ---------- Báo cáo ----------
const md = [
  '# Kết quả chạy các luồng API',
  '',
  `- Thời điểm: ${new Date().toISOString()}`,
  `- API: ${BASE}`,
  '- Script: `tests/smoke/minh-chung-api.mjs`. Mỗi bước chỉ "Đạt" khi đúng mã HTTP và đúng điều kiện nghiệp vụ ghi trong tên bước. Giá trị cookie JWT đã che; mật khẩu không ghi ra.',
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
