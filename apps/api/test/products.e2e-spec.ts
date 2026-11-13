/**
 * Kiểm thử API qua HTTP (Đề 6.3: kiểm thử tối thiểu cho API).
 * Database được thay bằng dữ liệu giả trong bộ nhớ để chạy được trong CI không cần PostgreSQL.
 * Task 5: menu cần đăng nhập (FR-01), nên các request gửi kèm cookie JWT hợp lệ.
 */
process.env.JWT_SECRET ??= 'khoa-kiem-thu-e2e-du-dai';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

const D = (v: number) => new Prisma.Decimal(v);
const ID = {
  caPhe: 'c1b2c3d4-0000-4000-8000-000000000001',
  traDao: 'c1b2c3d4-0000-4000-8000-000000000003',
  ngungBan: 'c1b2c3d4-0000-4000-8000-000000000006',
  khongCo: 'c1b2c3d4-0000-4000-8000-0000000000ff',
};

type Row = {
  id: string; name: string; description: string; basePrice: Prisma.Decimal; imageUrl: string | null;
  isActive: boolean; stockQuantity: number; reservedQuantity: number;
};

const rows: Row[] = [
  { id: ID.traDao, name: 'Trà đào', description: 'Trà đào cam sả', basePrice: D(39000), imageUrl: null,
    isActive: true, stockQuantity: 0, reservedQuantity: 0 },
  { id: ID.caPhe, name: 'Cà phê sữa', description: 'Phin', basePrice: D(29000), imageUrl: 'a.jpg',
    isActive: true, stockQuantity: 50, reservedQuantity: 3 },
  { id: ID.ngungBan, name: 'Sinh tố bơ', description: 'Ngừng bán', basePrice: D(45000), imageUrl: null,
    isActive: false, stockQuantity: 10, reservedQuantity: 0 },
];

/** Giả lập đúng phần Prisma mà ProductsService dùng. */
const fakePrisma = {
  product: {
    findMany: async ({ where }: { where: { isActive: boolean } }) =>
      rows.filter((r) => r.isActive === where.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    findFirst: async ({ where }: { where: { id: string; isActive: boolean } }) => {
      const r = rows.find((x) => x.id === where.id && x.isActive === where.isActive);
      if (!r) return null;
      return {
        ...r,
        sizes: [{ size: { id: 's-m', name: 'M', extraPrice: D(5000) } }],
        toppings: [{ topping: { id: 't-1', name: 'Kem cheese', price: D(10000), isActive: true } }],
      };
    },
  },
  $connect: async () => undefined,
  $disconnect: async () => undefined,
};

describe('Products API (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  const get = (url: string) => request(app.getHttpServer()).get(url).set('Cookie', cookie);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    const token = await app.get(JwtService).signAsync({ sub: 'u1', role: 'CUSTOMER' }, { jwtid: 'e2e', expiresIn: 1800 });
    cookie = `${AUTH_COOKIE}=${token}`;
  });

  it('chưa đăng nhập: GET /products và /products/:id trả 401, không trả danh sách (FR-01)', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(401);
    expect(Array.isArray(res.body)).toBe(false);
    await request(app.getHttpServer()).get(`/products/${ID.caPhe}`).expect(401);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /products trả 200, chỉ món đang bán, sắp theo tên', async () => {
    const res = await get('/products').expect(200);
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(['Cà phê sữa', 'Trà đào']);
  });

  it('GET /products giữ món hết hàng với availableQuantity = 0 (FR-01)', async () => {
    const res = await get('/products').expect(200);
    expect(res.body[1]).toEqual({
      id: ID.traDao, name: 'Trà đào', basePrice: 39000, imageUrl: null, availableQuantity: 0,
    });
  });

  it('GET /products/:id trả 200 kèm sizes, toppings, giá kiểu number', async () => {
    const res = await get(`/products/${ID.caPhe}`).expect(200);
    expect(res.body).toEqual({
      id: ID.caPhe, name: 'Cà phê sữa', description: 'Phin', basePrice: 29000, imageUrl: 'a.jpg',
      availableQuantity: 47,
      sizes: [{ id: 's-m', name: 'M', extraPrice: 5000 }],
      toppings: [{ id: 't-1', name: 'Kem cheese', price: 10000 }],
    });
  });

  it('GET /products/:id không có món trả 404 (FR-02)', async () => {
    const res = await get(`/products/${ID.khongCo}`).expect(404);
    expect(res.body).toEqual({ statusCode: 404, message: 'Không tìm thấy sản phẩm', error: 'Not Found' });
  });

  it('GET /products/:id món ngừng kinh doanh trả 404', async () => {
    await get(`/products/${ID.ngungBan}`).expect(404);
  });

  it('GET /products/:id sai định dạng UUID trả 400', async () => {
    const res = await get('/products/abc').expect(400);
    expect(res.body.statusCode).toBe(400);
  });
});
