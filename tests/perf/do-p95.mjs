// Đo thời gian phản hồi p95 theo NFR-01:
// "Với dữ liệu seed, chạy bằng docker-compose ở môi trường local, các API GET /products, GET /products/:id,
//  tạo đơn và thanh toán có thời gian phản hồi p95 dưới 500 ms qua 100 lần gọi liên tiếp."
//
// Cách chạy (sau `docker compose up --build -d` và `docker compose exec api npx prisma db seed`):
//   node tests/perf/do-p95.mjs                       # API mặc định http://localhost:3001
//   node tests/perf/do-p95.mjs --base http://localhost:3001 --out docs/minh-chung-p95/ket-qua.md
//
// Chỉ dùng Node 18+ (fetch, performance có sẵn), không cần cài thêm gói.
// Mỗi lần chạy đăng ký một tài khoản khách mới. Tạo đơn và thanh toán làm giảm tồn kho của database đang dùng,
// nên chạy trên database seed mới (xem docs/minh-chung-p95/README.md).

import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const BASE = opt('base', process.env.API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const SO_LAN = Number(opt('lan', '100'));
const NGUONG_MS = 500;
const OUT = opt('out', null);

let cookie = '';

async function goi(method, path, body) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text(); // đọc hết body trong thời gian đo
  const ms = performance.now() - t0;
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* body không phải JSON */ }
  return { status: res.status, ms, json, headers: res.headers };
}

/** p95 theo cách "nearest-rank": giá trị thứ ceil(0.95 × n) trong dãy đã sắp tăng dần. */
function phanVi(dsMs, p) {
  const s = [...dsMs].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)];
}

/**
 * Một API đạt khi: đủ SO_LAN mẫu, p95 < 500 ms và mọi mẫu có mã HTTP mong đợi
 * (200 danh sách, chi tiết; 201 tạo đơn; 200 hoặc 202 thanh toán).
 */
function tomTat(ten, ds, maMongDoi) {
  const ms = ds.map((d) => d.ms);
  const s = [...ms].sort((a, b) => a - b);
  const maTra = {};
  for (const d of ds) maTra[d.status] = (maTra[d.status] ?? 0) + 1;
  const duMau = ds.length === SO_LAN;
  const dungMa = ds.every((d) => maMongDoi.includes(d.status));
  const p95 = ds.length ? phanVi(ms, 95) : NaN;
  return {
    ten, soLan: ds.length,
    min: s[0] ?? NaN, trungVi: ds.length ? phanVi(ms, 50) : NaN, p95, max: s[s.length - 1] ?? NaN,
    duMau, dungMa, dat: duMau && dungMa && p95 < NGUONG_MS, maTra, maMongDoi,
  };
}

function dung(msg) {
  console.error(`Dừng: ${msg}`);
  process.exit(2);
}

// ---------- Chuẩn bị: tài khoản khách và danh sách món ----------
const health = await goi('GET', '/health').catch(() => null);
if (!health || health.status !== 200) dung(`không gọi được ${BASE}/health. API đã chạy chưa?`);

const email = `do-p95-${Date.now()}@vd.vn`;
const matKhau = `Do-p95-${randomUUID().slice(0, 8)}`;
const dk = await goi('POST', '/auth/register', { email, password: matKhau, fullName: 'Khách đo p95' });
if (dk.status !== 201 && dk.status !== 200) dung(`đăng ký tài khoản đo thất bại (HTTP ${dk.status}).`);
const dn = await goi('POST', '/auth/login', { email, password: matKhau });
const setCookie = dn.headers.get('set-cookie');
if (dn.status !== 200 || !setCookie) dung(`đăng nhập thất bại (HTTP ${dn.status}).`);
cookie = setCookie.split(';')[0];

const menu = await goi('GET', '/products');
if (menu.status !== 200 || !Array.isArray(menu.json) || menu.json.length === 0) dung('GET /products không có dữ liệu. Đã chạy seed chưa?');

// Món còn hàng, kèm size đầu tiên nếu món có size (FR-03). Tồn được theo dõi ở đây để không đặt quá số còn bán.
const mon = [];
for (const p of menu.json) {
  if (p.availableQuantity <= 0) continue;
  const ct = await goi('GET', `/products/${p.id}`);
  if (ct.status !== 200) continue;
  mon.push({ id: p.id, ten: p.name, sizeId: ct.json.sizes?.[0]?.id ?? null, con: p.availableQuantity });
}
const tongCon = mon.reduce((t, m) => t + m.con, 0);
if (tongCon < SO_LAN) dung(`chỉ còn ${tongCon} ly có thể bán, cần ${SO_LAN}. Chạy lại với database seed mới.`);
const idChiTiet = mon[0].id;

// ---------- Đo: mỗi API 100 lần liên tiếp, lần sau chỉ gửi khi lần trước đã trả về ----------
const ketQua = {};

ketQua.list = [];
for (let i = 0; i < SO_LAN; i++) ketQua.list.push(await goi('GET', '/products'));

ketQua.detail = [];
for (let i = 0; i < SO_LAN; i++) ketQua.detail.push(await goi('GET', `/products/${idChiTiet}`));

ketQua.checkout = [];
const donDaTao = [];
for (let i = 0; i < SO_LAN; i++) {
  const m = mon.reduce((a, b) => (b.con > a.con ? b : a)); // món còn nhiều nhất
  m.con -= 1;
  const item = { productId: m.id, quantity: 1, ...(m.sizeId ? { sizeId: m.sizeId } : {}) };
  const r = await goi('POST', '/orders/checkout', { requestId: `do-p95-${randomUUID()}`, items: [item] });
  ketQua.checkout.push(r);
  if (r.status === 201 && r.json?.id) donDaTao.push(r.json.id);
}

// Thanh toán từng đơn vừa tạo, khóa mới cho mỗi lần. Kịch bản mô phỏng do server chọn theo orderId + khóa
// (FR-07), nên có cả thành công, thất bại và "đang xử lý" như khi khách dùng thật.
ketQua.payment = [];
const trangThaiTra = {};
for (const orderId of donDaTao) {
  const r = await goi('POST', `/orders/${orderId}/payments`, { method: 'WALLET', idempotencyKey: `do-p95-${randomUUID()}` });
  ketQua.payment.push(r);
  const st = r.json?.payment?.status ?? `HTTP ${r.status}`;
  trangThaiTra[st] = (trangThaiTra[st] ?? 0) + 1;
}

// ---------- Báo cáo ----------
const bang = [
  tomTat('GET /products', ketQua.list, [200]),
  tomTat('GET /products/:id', ketQua.detail, [200]),
  tomTat('POST /orders/checkout', ketQua.checkout, [201]),
  tomTat('POST /orders/{id}/payments', ketQua.payment, [200, 202]),
];
const datHet = bang.every((b) => b.dat);
const chayThu = SO_LAN !== 100; // NFR-01 yêu cầu đúng 100 lần gọi
const lyDo = (b) => [!b.duMau && `thiếu mẫu (${b.soLan}/${SO_LAN})`, !b.dungMa && `có mã HTTP ngoài ${b.maMongDoi.join('/')}`, !(b.p95 < NGUONG_MS) && 'p95 ≥ 500 ms']
  .filter(Boolean).join('; ');
const f = (x) => x.toFixed(1);

const dong = [
  chayThu ? `# Chạy thử đo p95 với ${SO_LAN} lần gọi (không phải minh chứng NFR-01)` : `# Kết quả đo p95 (NFR-01)`,
  ``,
  `- Thời điểm: ${new Date().toISOString()}`,
  `- API: ${BASE}`,
  `- Máy đo: ${os.type()} ${os.release()}, ${os.cpus()[0]?.model ?? 'không rõ CPU'}, ${os.cpus().length} luồng, RAM ${(os.totalmem() / 2 ** 30).toFixed(1)} GB; Node ${process.version}`,
  `- Mỗi API gọi ${SO_LAN} lần liên tiếp (gọi xong lần trước mới gửi lần sau), không có lượt khởi động bỏ qua. Thời gian tính từ lúc gửi request tới lúc đọc hết body, đo ở máy gọi.`,
  `- p95 tính theo nearest-rank: giá trị thứ ceil(0,95 × n) sau khi sắp tăng dần. Ngưỡng: p95 < ${NGUONG_MS} ms.`,
  ``,
  `| API | Số lần | Min (ms) | Trung vị (ms) | p95 (ms) | Max (ms) | Mã HTTP (mong đợi) | Đạt |`,
  `|---|---|---|---|---|---|---|---|`,
  ...bang.map((b) => `| \`${b.ten}\` | ${b.soLan} | ${f(b.min)} | ${f(b.trungVi)} | ${f(b.p95)} | ${f(b.max)} | ${Object.entries(b.maTra).map(([k, v]) => `${k}×${v}`).join(', ')} (${b.maMongDoi.join('/')}) | ${b.dat ? 'Đạt' : `Không đạt: ${lyDo(b)}`} |`),
  ``,
  `Kết quả thanh toán do bộ mô phỏng chọn: ${Object.entries(trangThaiTra).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
  ``,
  `**Kết luận:** ${chayThu ? `chạy thử ${SO_LAN} lần, không dùng làm minh chứng NFR-01 (cần đúng 100 lần). ` : ''}${datHet ? `Cả 4 API đủ ${SO_LAN} mẫu, đúng mã HTTP và p95 < 500 ms.` : 'Chưa đạt, xem lý do ở cột "Đạt".'}`,
  ``,
];
const md = dong.join('\n');
console.log(md);
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md, 'utf8');
  console.log(`Đã ghi kết quả vào ${OUT}`);
}
process.exit(datHet && !chayThu ? 0 : 1);
