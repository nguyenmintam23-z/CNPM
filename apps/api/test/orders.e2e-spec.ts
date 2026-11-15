/**
 * Kiểm thử HTTP cho POST /orders/checkout: xác thực, phân quyền, kiểm tra dữ liệu và mã trạng thái
 * (FR-06, FR-12, FR-18, NFR-02, NFR-04; UC-01 E1, E4, E8).
 * OrdersService được thay bằng bản giả để chạy trong CI không cần PostgreSQL. Luồng transaction thật
 * với PostgreSQL được kiểm bằng tay và bằng integration test (tests/integration).
 */
process.env.JWT_SECRET ??= 'khoa-kiem-thu-e2e-du-dai';
import { ConflictException, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE } from '../src/auth/auth.types';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

const P = 'c1b2c3d4-0000-4000-8000-000000000002';
const S = 'a1b2c3d4-0000-4000-8000-000000000003';
const T = 'b1b2c3d4-0000-4000-8000-000000000001';
const DON = { id: 'o1', orderCode: 'BL-261115-ABCDE', status: 'PENDING_PAYMENT', totalAmount: 52000, items: [] };

describe('POST /orders/checkout (e2e)', () => {
  let app: INestApplication<App>;
  const checkout = jest.fn();
  const cookie: Record<string, string> = {};
  const post = (body: unknown, vaiTro?: string) => {
    const r = request(app.getHttpServer()).post('/orders/checkout');
    return (vaiTro ? r.set('Cookie', cookie[vaiTro]) : r).send(body as object);
  };
  const hopLe = { requestId: 'req-0001-abcd', items: [{ productId: P, sizeId: S, toppingIds: [T], quantity: 2 }] };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: async () => undefined, $disconnect: async () => undefined })
      .overrideProvider(OrdersService)
      .useValue({ checkout })
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    const jwt = app.get(JwtService);
    for (const role of ['CUSTOMER', 'STAFF', 'MANAGER']) {
      cookie[role] = `${AUTH_COOKIE}=${await jwt.signAsync({ sub: `u-${role}`, role }, { jwtid: role, expiresIn: 1800 })}`;
    }
  });
  afterAll(async () => app.close());
  beforeEach(() => checkout.mockReset());

  it('chưa đăng nhập → 401, không gọi tạo đơn (FR-12, UC-01 A1)', async () => {
    await post(hopLe).expect(401);
    expect(checkout).not.toHaveBeenCalled();
  });

  it.each(['STAFF', 'MANAGER'])('%s đặt đơn → 403 (UC-01 E8)', async (role) => {
    await post(hopLe, role).expect(403);
    expect(checkout).not.toHaveBeenCalled();
  });

  it('khách hàng đặt đơn mới → 201, truyền userId từ JWT, không lấy từ body', async () => {
    checkout.mockResolvedValue({ order: DON, created: true });
    const res = await post(hopLe, 'CUSTOMER').expect(201);
    expect(res.body).toEqual(DON);
    expect(checkout).toHaveBeenCalledWith('u-CUSTOMER', 'req-0001-abcd', hopLe.items);
  });

  it('gửi lại cùng requestId → 200 với đơn cũ (FR-18, E4)', async () => {
    checkout.mockResolvedValue({ order: DON, created: false });
    await post(hopLe, 'CUSTOMER').expect(200, DON);
  });

  it('client gửi giá hoặc tổng tiền → 400, không tạo đơn (FR-06: tổng tiền tính ở server)', async () => {
    await post({ ...hopLe, totalAmount: 1 }, 'CUSTOMER').expect(400);
    await post({ ...hopLe, items: [{ ...hopLe.items[0], unitPrice: 1 }] }, 'CUSTOMER').expect(400);
    expect(checkout).not.toHaveBeenCalled();
  });

  it.each([
    ['giỏ trống', { ...hopLe, items: [] }, 'Giỏ hàng trống'],
    ['số lượng 0', { ...hopLe, items: [{ productId: P, quantity: 0 }] }, 'Số lượng tối thiểu là 1'],
    ['số lượng lẻ', { ...hopLe, items: [{ productId: P, quantity: 1.5 }] }, 'Số lượng phải là số nguyên'],
    ['productId sai định dạng', { ...hopLe, items: [{ productId: 'abc', quantity: 1 }] }, 'productId không hợp lệ'],
    ['quá 5 topping', { ...hopLe, items: [{ productId: P, quantity: 1, toppingIds: Array(6).fill(T) }] }, 'Mỗi món tối đa 5 topping'],
    ['thiếu requestId', { items: hopLe.items }, 'requestId gồm 8–64 ký tự chữ, số, - hoặc _'],
  ])('%s → 400 (FR-13, NFR-04)', async (_, body, msg) => {
    const res = await post(body, 'CUSTOMER').expect(400);
    expect(JSON.stringify(res.body.message)).toContain(msg);
    expect(checkout).not.toHaveBeenCalled();
  });

  it('thiếu hàng → 409 kèm shortages, giữ nguyên nội dung lỗi của service (E2)', async () => {
    const body = { statusCode: 409, error: 'Conflict', message: 'Một số món không đủ hàng', shortages: [{ productId: P, available: 0 }] };
    checkout.mockRejectedValue(new ConflictException(body));
    await post(hopLe, 'CUSTOMER').expect(409, body);
  });
});
