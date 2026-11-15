/**
 * Kiểm thử HTTP cho API nhân viên quầy: GET /staff/orders, GET /staff/orders/:id, PATCH /staff/orders/:id/status
 * (FR-09, FR-10, FR-17; NFR-02). StaffOrdersService được thay bằng bản giả để chạy trong CI không cần PostgreSQL.
 * Ghi có điều kiện với PostgreSQL thật được kiểm bằng script tay trong .tam.
 */
process.env.JWT_SECRET ??= 'khoa-kiem-thu-e2e-du-dai';
import { BadRequestException, ConflictException, INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { StaffOrdersService } from '../src/orders/staff-orders.service';
import { setupApp } from '../src/setup-app';

const ID = 'd1b2c3d4-0000-4000-8000-000000000001';
const DON = { id: ID, orderCode: 'BL-261115-ABCDE', status: 'CONFIRMED', totalAmount: 52000, items: [] };

describe('API nhân viên quầy (e2e)', () => {
  let app: INestApplication<App>;
  const queue = jest.fn();
  const detail = jest.fn();
  const advance = jest.fn();
  const cookie: Record<string, string> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: async () => undefined, $disconnect: async () => undefined })
      .overrideProvider(StaffOrdersService)
      .useValue({ queue, detail, advance })
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
    queue.mockReset();
    detail.mockReset();
    advance.mockReset();
  });

  const goi = (method: 'get' | 'patch', url: string, vaiTro?: string) => {
    const r = request(app.getHttpServer())[method](url);
    return vaiTro ? r.set('Cookie', cookie[vaiTro]) : r;
  };

  describe('phân quyền (FR-17, NFR-02)', () => {
    it.each([
      ['get', '/staff/orders'],
      ['get', `/staff/orders/${ID}`],
      ['patch', `/staff/orders/${ID}/status`],
    ] as ['get' | 'patch', string][])('%s %s: chưa đăng nhập → 401', async (m, url) => {
      await goi(m, url).expect(401);
    });

    it.each(['CUSTOMER', 'MANAGER'])('%s gọi API nhân viên → 403, không gọi service', async (role) => {
      await goi('get', '/staff/orders', role).expect(403);
      await goi('get', `/staff/orders/${ID}`, role).expect(403);
      await goi('patch', `/staff/orders/${ID}/status`, role).send({ from: 'CONFIRMED', to: 'PREPARING' }).expect(403);
      expect(queue).not.toHaveBeenCalled();
      expect(detail).not.toHaveBeenCalled();
      expect(advance).not.toHaveBeenCalled();
    });
  });

  describe('GET /staff/orders, GET /staff/orders/:id (FR-09)', () => {
    it('STAFF xem hàng chờ → 200', async () => {
      queue.mockResolvedValue([DON]);
      await goi('get', '/staff/orders', 'STAFF').expect(200, [DON]);
    });

    it('STAFF xem chi tiết → 200; mã không phải UUID → 400', async () => {
      detail.mockResolvedValue(DON);
      await goi('get', `/staff/orders/${ID}`, 'STAFF').expect(200, DON);
      expect(detail).toHaveBeenCalledWith(ID);
      await goi('get', '/staff/orders/abc', 'STAFF').expect(400);
      expect(detail).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /staff/orders/:id/status (FR-10, FR-17)', () => {
    it('STAFF chuyển bước kế tiếp → 200, truyền id nhân viên từ JWT', async () => {
      advance.mockResolvedValue({ ...DON, status: 'PREPARING' });
      const res = await goi('patch', `/staff/orders/${ID}/status`, 'STAFF').send({ from: 'CONFIRMED', to: 'PREPARING' }).expect(200);
      expect(res.body.status).toBe('PREPARING');
      expect(advance).toHaveBeenCalledWith('u-STAFF', ID, 'CONFIRMED', 'PREPARING');
    });

    it.each([
      ['thiếu from', { to: 'PREPARING' }],
      ['trạng thái lạ', { from: 'CONFIRMED', to: 'DONE' }],
      ['trường lạ', { from: 'CONFIRMED', to: 'PREPARING', stockHoldStatus: 'RELEASED' }],
    ])('%s → 400, không gọi service', async (_, body) => {
      await goi('patch', `/staff/orders/${ID}/status`, 'STAFF').send(body).expect(400);
      expect(advance).not.toHaveBeenCalled();
    });

    it('bỏ bước → 400 INVALID_TRANSITION, giữ nội dung lỗi của service', async () => {
      const body = { statusCode: 400, error: 'Bad Request', message: 'x', code: 'INVALID_TRANSITION' };
      advance.mockRejectedValue(new BadRequestException(body));
      await goi('patch', `/staff/orders/${ID}/status`, 'STAFF').send({ from: 'CONFIRMED', to: 'READY' }).expect(400, body);
    });

    it('trạng thái đã đổi → 409 kèm đơn mới nhất', async () => {
      const body = { statusCode: 409, error: 'Conflict', message: 'x', code: 'ORDER_STATUS_CHANGED', order: { ...DON, status: 'PREPARING' } };
      advance.mockRejectedValue(new ConflictException(body));
      await goi('patch', `/staff/orders/${ID}/status`, 'STAFF').send({ from: 'CONFIRMED', to: 'PREPARING' }).expect(409, body);
    });
  });
});
