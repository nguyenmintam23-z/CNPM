/**
 * Kiểm thử HTTP cho API tra cứu đơn của quản lý: GET /manager/orders, GET /manager/orders/:id
 * (FR-11; NFR-02). ManagerOrdersService được thay bằng bản giả để chạy trong CI không cần PostgreSQL.
 */
process.env.JWT_SECRET ??= 'khoa-kiem-thu-e2e-du-dai';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE } from '../src/auth/auth.types';
import { ManagerOrdersService } from '../src/orders/manager-orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

const ID = 'd1b2c3d4-0000-4000-8000-000000000001';
const DON = { id: ID, orderCode: 'BL-261115-ABCDE', status: 'PENDING_PAYMENT', payments: [{ status: 'FAILED', failureReason: 'x' }] };

describe('API tra cứu đơn cho quản lý (e2e)', () => {
  let app: INestApplication<App>;
  const list = jest.fn();
  const detail = jest.fn();
  const cookie: Record<string, string> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: async () => undefined, $disconnect: async () => undefined })
      .overrideProvider(ManagerOrdersService)
      .useValue({ list, detail })
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
  beforeEach(() => {
    list.mockReset();
    detail.mockReset();
  });

  const get = (url: string, vaiTro?: string) => {
    const r = request(app.getHttpServer()).get(url);
    return vaiTro ? r.set('Cookie', cookie[vaiTro]) : r;
  };

  it('chưa đăng nhập → 401', async () => {
    await get('/manager/orders').expect(401);
    await get(`/manager/orders/${ID}`).expect(401);
  });

  it.each(['CUSTOMER', 'STAFF'])('%s gọi API quản lý → 403, không gọi service', async (role) => {
    await get('/manager/orders', role).expect(403);
    await get(`/manager/orders/${ID}`, role).expect(403);
    expect(list).not.toHaveBeenCalled();
    expect(detail).not.toHaveBeenCalled();
  });

  it('MANAGER không lọc → 200, mặc định trang 1, 20 đơn', async () => {
    list.mockResolvedValue({ items: [DON], page: 1, pageSize: 20, total: 1 });
    await get('/manager/orders', 'MANAGER').expect(200);
    expect(list).toHaveBeenCalledWith(undefined, 1, 20);
  });

  it('MANAGER lọc Chờ thanh toán → truyền đúng trạng thái (FR-11)', async () => {
    list.mockResolvedValue({ items: [], page: 1, pageSize: 5, total: 0 });
    await get('/manager/orders?status=PENDING_PAYMENT&pageSize=5', 'MANAGER').expect(200);
    expect(list).toHaveBeenCalledWith('PENDING_PAYMENT', 1, 5);
  });

  it.each([
    ['status=DONE', 'status không phải trạng thái đơn hợp lệ'],
    ['page=0', 'page tối thiểu là 1'],
    ['pageSize=51', 'pageSize tối đa là 50'],
  ])('%s → 400', async (query, msg) => {
    const res = await get(`/manager/orders?${query}`, 'MANAGER').expect(400);
    expect(JSON.stringify(res.body.message)).toContain(msg);
    expect(list).not.toHaveBeenCalled();
  });

  it('MANAGER xem chi tiết → 200 kèm các lần thanh toán; id sai → 400', async () => {
    detail.mockResolvedValue(DON);
    await get(`/manager/orders/${ID}`, 'MANAGER').expect(200, DON);
    expect(detail).toHaveBeenCalledWith(ID);
    await get('/manager/orders/abc', 'MANAGER').expect(400);
    expect(detail).toHaveBeenCalledTimes(1);
  });
});
