/**
 * Kiểm thử HTTP cho POST /orders/{id}/payments: xác thực, phân quyền, kiểm tra dữ liệu, mã trạng thái
 * (FR-07, FR-12, FR-15; UC-01 E6, E8; Sequence Checkout).
 * PaymentsService được thay bằng bản giả để chạy trong CI không cần PostgreSQL. Luồng thật với PostgreSQL
 * được kiểm riêng (xem mô tả PR).
 */
process.env.JWT_SECRET ??= 'khoa-kiem-thu-e2e-du-dai';
import { ConflictException, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE } from '../src/auth/auth.types';
import { PaymentsService } from '../src/payment/payments.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

const ORDER_ID = '9b9d35d9-f182-4b4e-bf91-5288e1a69a67';
const ket = (status: string) => ({
  payment: { id: 'pay1', method: 'WALLET', status, amount: 52000, createdAt: '2026-11-15T03:00:00.000Z', completedAt: null },
  order: { id: ORDER_ID, orderCode: 'BL-261115-ABCDE', status: status === 'SUCCEEDED' ? 'CONFIRMED' : 'PENDING_PAYMENT', stockHoldStatus: 'HELD' },
});

describe('POST /orders/{id}/payments (e2e)', () => {
  let app: INestApplication<App>;
  const pay = jest.fn();
  const cookie: Record<string, string> = {};
  const post = (body: unknown, vaiTro?: string, id = ORDER_ID) => {
    const r = request(app.getHttpServer()).post(`/orders/${id}/payments`);
    return (vaiTro ? r.set('Cookie', cookie[vaiTro]) : r).send(body as object);
  };
  const hopLe = { method: 'WALLET', idempotencyKey: 'key-0001-abcd' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: async () => undefined, $disconnect: async () => undefined })
      .overrideProvider(PaymentsService)
      .useValue({ pay })
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    const jwt = app.get(JwtService);
    for (const role of ['CUSTOMER', 'STAFF']) {
      cookie[role] = `${AUTH_COOKIE}=${await jwt.signAsync({ sub: `u-${role}`, role }, { jwtid: role, expiresIn: 1800 })}`;
    }
  });
  afterAll(async () => app.close());
  beforeEach(() => pay.mockReset());

  it('chưa đăng nhập → 401; nhân viên → 403; không gọi thanh toán', async () => {
    await post(hopLe).expect(401);
    await post(hopLe, 'STAFF').expect(403);
    expect(pay).not.toHaveBeenCalled();
  });

  it('thành công → 200, truyền userId từ JWT', async () => {
    pay.mockResolvedValue(ket('SUCCEEDED'));
    await post(hopLe, 'CUSTOMER').expect(200, ket('SUCCEEDED'));
    expect(pay).toHaveBeenCalledWith('u-CUSTOMER', ORDER_ID, 'WALLET', 'key-0001-abcd');
  });

  it('thất bại → 200 với payment.status = FAILED (kết quả nghiệp vụ, không phải lỗi HTTP)', async () => {
    pay.mockResolvedValue(ket('FAILED'));
    const res = await post(hopLe, 'CUSTOMER').expect(200);
    expect(res.body.payment.status).toBe('FAILED');
  });

  it('chưa có kết quả → 202 PROCESSING (E6)', async () => {
    pay.mockResolvedValue(ket('PROCESSING'));
    const res = await post(hopLe, 'CUSTOMER').expect(202);
    expect(res.body.payment.status).toBe('PROCESSING');
  });

  it.each([
    ['phương thức khác Ví/Thẻ', { ...hopLe, method: 'CASH' }, 'Phương thức thanh toán phải là WALLET hoặc CARD'],
    ['thiếu idempotencyKey', { method: 'CARD' }, 'idempotencyKey gồm 8–64 ký tự chữ, số, - hoặc _'],
    ['gửi kèm số tiền', { ...hopLe, amount: 1 }, 'property amount should not exist'],
    ['gửi kèm kịch bản mô phỏng', { ...hopLe, scenario: 'SUCCESS' }, 'property scenario should not exist'],
  ])('%s → 400, không gọi thanh toán', async (_, body, msg) => {
    const res = await post(body, 'CUSTOMER').expect(400);
    expect(JSON.stringify(res.body.message)).toContain(msg);
    expect(pay).not.toHaveBeenCalled();
  });

  it('mã đơn sai định dạng → 400', async () => {
    await post(hopLe, 'CUSTOMER', 'abc').expect(400);
  });

  it('409 từ service được giữ nguyên nội dung (đơn không chờ thanh toán, đang xử lý, hết hàng khi thử lại)', async () => {
    const body = { statusCode: 409, error: 'Conflict', message: 'Đơn đang có một lần thanh toán đang xử lý', code: 'PAYMENT_IN_PROGRESS' };
    pay.mockRejectedValue(new ConflictException(body));
    await post(hopLe, 'CUSTOMER').expect(409, body);
  });
});
