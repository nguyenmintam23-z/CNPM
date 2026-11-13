/**
 * Kiểm thử API qua HTTP (Đề 6.3: kiểm thử tối thiểu cho API).
 * Database được thay bằng dữ liệu giả trong bộ nhớ để chạy được trong CI không cần PostgreSQL.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(fakePrisma)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /products trả 200, chỉ món đang bán, sắp theo tên', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200);
    expect(res.body.map((p: { name: string }) => p.name)).toEqual(['Cà phê sữa', 'Trà đào']);
  });

  it('GET /products giữ món hết hàng với availableQuantity = 0 (FR-01)', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200);
    expect(res.body[1]).toEqual({
      id: ID.traDao, name: 'Trà đào', basePrice: 39000, imageUrl: null, availableQuantity: 0,
    });
  });

  it('GET /products/:id trả 200 kèm sizes, toppings, giá kiểu number', async () => {
    const res = await request(app.getHttpServer()).get(`/products/${ID.caPhe}`).expect(200);
    expect(res.body).toEqual({
      id: ID.caPhe, name: 'Cà phê sữa', description: 'Phin', basePrice: 29000, imageUrl: 'a.jpg',
      availableQuantity: 47,
      sizes: [{ id: 's-m', name: 'M', extraPrice: 5000 }],
      toppings: [{ id: 't-1', name: 'Kem cheese', price: 10000 }],
    });
  });

  it('GET /products/:id không có món trả 404 (FR-02)', async () => {
    const res = await request(app.getHttpServer()).get(`/products/${ID.khongCo}`).expect(404);
    expect(res.body).toEqual({ statusCode: 404, message: 'Không tìm thấy sản phẩm', error: 'Not Found' });
  });

  it('GET /products/:id món ngừng kinh doanh trả 404', async () => {
    await request(app.getHttpServer()).get(`/products/${ID.ngungBan}`).expect(404);
  });

  it('GET /products/:id sai định dạng UUID trả 400', async () => {
    const res = await request(app.getHttpServer()).get('/products/abc').expect(400);
    expect(res.body.statusCode).toBe(400);
  });
});
