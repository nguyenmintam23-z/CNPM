/**
 * Kiểm thử HTTP cho GET /orders, GET /orders/:id, POST /orders/:id/cancel: xác thực, phân quyền,
 * kiểm tra tham số và mã trạng thái (FR-08, FR-23, FR-24; NFR-02).
 * OrdersService được thay bằng bản giả để chạy trong CI không cần PostgreSQL. Luồng hủy với
 * PostgreSQL thật được kiểm bằng script tay trong .tam.
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

const ID = 'd1b2c3d4-0000-4000-8000-000000000001';
const DON = { id: ID, orderCode: 'BL-261115-ABCDE', status: 'PENDING_PAYMENT', totalAmount: 52000, items: [] };

describe('GET /orders, GET /orders/:id, POST /orders/:id/cancel (e2e)', () => {
  let app: INestApplication<App>;
  const list = jest.fn();
  const detail = jest.fn();
  const cancel = jest.fn();
  const cookie: Record<string, string> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: async () => undefined, $disconnect: async () => undefined })
      .overrideProvider(OrdersService)
      .useValue({ list, detail, cancel })
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
    cancel.mockReset();
  });

  const bieuThuc = (method: 'get' | 'post', url: string, vaiTro?: string) => {
    const r = request(app.getHttpServer())[method](url);
    return vaiTro ? r.set('Cookie', cookie[vaiTro]) : r;
  };

  describe('GET /orders (FR-08)', () => {
    it('chưa đăng nhập → 401 (NFR-02)', async () => {
      await bieuThuc('get', '/orders').expect(401);
      expect(list).not.toHaveBeenCalled();
    });

    it.each(['STAFF', 'MANAGER'])('%s xem lịch sử khách → 403 (NFR-02)', async (role) => {
      await bieuThuc('get', '/orders', role).expect(403);
      expect(list).not.toHaveBeenCalled();
    });

    it('khách xem lịch sử mặc định → 200, page 1, pageSize 20, lấy userId từ JWT', async () => {
      list.mockResolvedValue({ items: [DON], page: 1, pageSize: 20, total: 1 });
      const res = await bieuThuc('get', '/orders', 'CUSTOMER').expect(200);
      expect(res.body).toEqual({ items: [DON], page: 1, pageSize: 20, total: 1 });
      expect(list).toHaveBeenCalledWith('u-CUSTOMER', 1, 20);
    });

    it('truyền page và pageSize đúng kiểu số', async () => {
      list.mockResolvedValue({ items: [], page: 3, pageSize: 5, total: 0 });
      await bieuThuc('get', '/orders?page=3&pageSize=5', 'CUSTOMER').expect(200);
      expect(list).toHaveBeenCalledWith('u-CUSTOMER', 3, 5);
    });

    it.each([
      ['page=0', 'page tối thiểu là 1'],
      ['page=abc', 'page phải là số nguyên'],
      ['pageSize=51', 'pageSize tối đa là 50'],
      ['pageSize=0', 'pageSize tối thiểu là 1'],
    ])('%s → 400 (%s)', async (query, msg) => {
      const res = await bieuThuc('get', `/orders?${query}`, 'CUSTOMER').expect(400);
      expect(JSON.stringify(res.body.message)).toContain(msg);
      expect(list).not.toHaveBeenCalled();
    });
  });

  describe('GET /orders/:id (FR-08)', () => {
    it('chưa đăng nhập → 401', async () => {
      await bieuThuc('get', `/orders/${ID}`).expect(401);
    });

    it('STAFF xem chi tiết → 403', async () => {
      await bieuThuc('get', `/orders/${ID}`, 'STAFF').expect(403);
      expect(detail).not.toHaveBeenCalled();
    });

    it('khách xem đơn của mình → 200', async () => {
      detail.mockResolvedValue(DON);
      await bieuThuc('get', `/orders/${ID}`, 'CUSTOMER').expect(200, DON);
      expect(detail).toHaveBeenCalledWith('u-CUSTOMER', ID);
    });

    it('mã đơn không phải UUID → 400, không gọi service', async () => {
      await bieuThuc('get', '/orders/abc', 'CUSTOMER').expect(400);
      expect(detail).not.toHaveBeenCalled();
    });
  });

  describe('POST /orders/:id/cancel (FR-23)', () => {
    it('chưa đăng nhập → 401', async () => {
      await bieuThuc('post', `/orders/${ID}/cancel`).expect(401);
      expect(cancel).not.toHaveBeenCalled();
    });

    it.each(['STAFF', 'MANAGER'])('%s hủy đơn → 403', async (role) => {
      await bieuThuc('post', `/orders/${ID}/cancel`, role).expect(403);
      expect(cancel).not.toHaveBeenCalled();
    });

    it('khách hủy đơn của mình → 200, trả đơn sau khi hủy', async () => {
      cancel.mockResolvedValue({ ...DON, status: 'CANCELLED' });
      const res = await bieuThuc('post', `/orders/${ID}/cancel`, 'CUSTOMER').expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED' });
      expect(cancel).toHaveBeenCalledWith('u-CUSTOMER', ID);
    });

    it('đơn không còn hủy được → 409 kèm mã lỗi từ service', async () => {
      const body = { statusCode: 409, error: 'Conflict', message: 'x', code: 'ORDER_NOT_CANCELLABLE', orderStatus: 'CONFIRMED' };
      cancel.mockRejectedValue(new ConflictException(body));
      await bieuThuc('post', `/orders/${ID}/cancel`, 'CUSTOMER').expect(409, body);
    });

    it('mã đơn không phải UUID → 400', async () => {
      await bieuThuc('post', '/orders/xyz/cancel', 'CUSTOMER').expect(400);
      expect(cancel).not.toHaveBeenCalled();
    });
  });
});
