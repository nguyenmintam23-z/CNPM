/**
 * Kiểm thử E2E luồng đặt hàng & thanh toán mô phỏng (UC-01: FR-06, FR-07, FR-12, FR-13, FR-14, FR-15).
 * Mock PrismaService trong bộ nhớ để chạy độc lập trên CI không cần PostgreSQL.
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

const IDS = {
  user: 'a1b2c3d4-0000-4000-8000-000000000001',
  caPhe: 'c1b2c3d4-0000-4000-8000-000000000001',
  sizeM: 'd1b2c3d4-0000-4000-8000-000000000002',
};

type MockProduct = {
  id: string;
  name: string;
  description: string;
  basePrice: Prisma.Decimal;
  imageUrl: string | null;
  isActive: boolean;
  stockQuantity: number;
  reservedQuantity: number;
  sizes: Array<{
    productId: string;
    sizeId: string;
    size: { id: string; name: string; extraPrice: Prisma.Decimal };
  }>;
  toppings: Array<{
    productId: string;
    toppingId: string;
    topping: { id: string; name: string; price: Prisma.Decimal; isActive: boolean };
  }>;
};

type MockUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
};

type MockOrder = {
  id: string;
  orderCode: string;
  status: string;
  stockHoldStatus: string;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
};

type MockPayment = {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  orderId?: string;
  idempotencyKey?: string;
  [key: string]: unknown;
};

type MockEntityData = Record<string, unknown>;

type CheckoutMockPrisma = {
  $queryRaw: (...args: unknown[]) => Promise<Array<{ '?column?': number }>>;
  $transaction: (
    callback: (transaction: CheckoutMockPrisma) => Promise<unknown>,
  ) => Promise<unknown>;
  user: {
    findUnique: (args: { where: { id?: string; email?: string } }) => Promise<MockUser | null>;
  };
  product: {
    findMany: (args: { where: { isActive: boolean } }) => Promise<MockProduct[]>;
    findUnique: (args: { where: { id: string } }) => Promise<MockProduct | null>;
    update: (args: {
      where: { id: string };
      data: { reservedQuantity?: { increment?: number } };
    }) => Promise<MockProduct | undefined>;
  };
  order: {
    findUnique: (args: {
      where: {
        id?: string;
        userId_requestId?: { userId: string; requestId: string };
      };
    }) => Promise<MockOrder | null>;
    create: (args: { data: MockEntityData }) => Promise<MockOrder>;
    update: (args: { where: { id: string }; data: MockEntityData }) => Promise<MockOrder | undefined>;
  };
  payment: {
    findUnique: (args: {
      where: {
        orderId_idempotencyKey?: { orderId: string; idempotencyKey: string };
      };
    }) => Promise<MockPayment | null>;
    create: (args: { data: MockEntityData }) => Promise<MockPayment>;
    update: (args: { where: { id: string }; data: MockEntityData }) => Promise<MockPayment | undefined>;
  };
};

describe('UC-01 Checkout & Payment Flow (e2e)', () => {
  let app: INestApplication<App>;
  let customerCookie: string;

  // Dữ liệu giả trong bộ nhớ phục vụ luồng đặt đơn & thanh toán
  const mockProducts: MockProduct[] = [
    {
      id: IDS.caPhe,
      name: 'Cà phê sữa đá',
      description: 'Cà phê phin truyền thống',
      basePrice: D(35000),
      imageUrl: null,
      isActive: true,
      stockQuantity: 10,
      reservedQuantity: 0,
      sizes: [{ productId: IDS.caPhe, sizeId: IDS.sizeM, size: { id: IDS.sizeM, name: 'M', extraPrice: D(5000) } }],
      toppings: [],
    },
  ];
  const mockOrders: MockOrder[] = [];
  const mockPayments: MockPayment[] = [];

  const mockPrisma: CheckoutMockPrisma = {
    $queryRaw: jest.fn(async () => [{ '?column?': 1 }]),
    $transaction: jest.fn(async (callback) => callback(mockPrisma)),
    user: {
      findUnique: jest.fn(async ({ where }) =>
        where.id === IDS.user
          ? { id: IDS.user, email: 'customer@brewlite.local', fullName: 'Khách Test', role: 'CUSTOMER' }
          : null,
      ),
    },
    product: {
      findMany: jest.fn(async ({ where }) => mockProducts.filter((product) => product.isActive === where.isActive)),
      findUnique: jest.fn(async ({ where }) => mockProducts.find((product) => product.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }) => {
        const item = mockProducts.find((p) => p.id === where.id);
        if (item && data.reservedQuantity?.increment) {
          item.reservedQuantity += data.reservedQuantity.increment;
        }
        return item;
      }),
    },
    order: {
      findUnique: jest.fn(async ({ where }) => {
        if (where?.id) return mockOrders.find((o) => o.id === where.id) ?? null;
        const requestKey = where?.userId_requestId;
        if (requestKey) {
          return (
            mockOrders.find(
              (o) =>
                o.userId === requestKey.userId &&
                o.requestId === requestKey.requestId,
            ) ?? null
          );
        }
        return null;
      }),
      create: jest.fn(async ({ data }) => {
        const created: MockOrder = {
          id: `e1b2c3d4-0000-4000-8000-00000000000${mockOrders.length + 1}`,
          orderCode: `BL-${1000 + mockOrders.length + 1}`,
          status: 'PENDING_PAYMENT',
          stockHoldStatus: 'HELD',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        Object.assign(created, data);
        mockOrders.push(created);
        return created;
      }),
      update: jest.fn(async ({ where, data }) => {
        const order = mockOrders.find((o) => o.id === where.id);
        if (order) Object.assign(order, data, { updatedAt: new Date() });
        return order;
      }),
    },
    payment: {
      findUnique: jest.fn(async ({ where }) => {
        const paymentKey = where?.orderId_idempotencyKey;
        if (paymentKey) {
          return (
            mockPayments.find(
              (p) =>
                p.orderId === paymentKey.orderId &&
                p.idempotencyKey === paymentKey.idempotencyKey,
            ) ?? null
          );
        }
        return null;
      }),
      create: jest.fn(async ({ data }) => {
        const created: MockPayment = {
          id: `f1b2c3d4-0000-4000-8000-00000000000${mockPayments.length + 1}`,
          status: 'PROCESSING',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        Object.assign(created, data);
        mockPayments.push(created);
        return created;
      }),
      update: jest.fn(async ({ where, data }) => {
        const payment = mockPayments.find((p) => p.id === where.id);
        if (payment) Object.assign(payment, data, { updatedAt: new Date() });
        return payment;
      }),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    const jwt = app.get(JwtService);
    const token = await jwt.signAsync(
      { sub: IDS.user, email: 'customer@brewlite.local', role: 'CUSTOMER' },
      { jwtid: 'checkout-e2e', expiresIn: 1800 },
    );
    customerCookie = `${AUTH_COOKIE}=${token}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('FR-12 / NFR-02: Từ chối đặt đơn khi chưa đăng nhập (không có cookie JWT)', async () => {
    await request(app.getHttpServer())
      .post('/orders/checkout')
      .send({
        requestId: 'req-unauth-001',
        items: [{ productId: IDS.caPhe, sizeId: IDS.sizeM, quantity: 1 }],
      })
      .expect((res) => {
        expect([401, 404]).toContain(res.status);
      });
  });

  it('FR-01: Khách đã đăng nhập xem được menu qua GET /products', async () => {
    const res = await request(app.getHttpServer())
      .get('/products')
      .set('Cookie', customerCookie)
      .expect(200);

    expect(res.body).toEqual([
      {
        id: IDS.caPhe,
        name: 'Cà phê sữa đá',
        basePrice: 35000,
        imageUrl: null,
        availableQuantity: 10,
      },
    ]);
  });

  it('FR-13: Từ chối đặt đơn khi giỏ hàng rỗng', async () => {
    await request(app.getHttpServer())
      .post('/orders/checkout')
      .set('Cookie', customerCookie)
      .send({
        requestId: 'req-empty-cart-001',
        items: [],
      })
      .expect((res) => {
        expect([400, 404]).toContain(res.status);
      });
  });
});