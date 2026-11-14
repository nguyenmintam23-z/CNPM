/**
 * Integration test mức database cho tạo đơn và thanh toán (Task 5.2, phần của Đại).
 *
 * Chạy với PostgreSQL thật (đã `prisma migrate deploy`), KHÔNG mock Prisma. Kiểm tra các bảo đảm
 * mà backend-data-design §4.3 và §5 dựa vào, để service của Duy có chỗ tựa:
 *   - FR-18  UNIQUE (user_id, request_id): gửi lại cùng mã yêu cầu chỉ tạo một đơn
 *   - FR-15  UNIQUE (order_id, idempotency_key): cùng khóa chỉ có một Payment
 *   - FR-14  thanh toán lại trên cùng đơn bằng khóa mới được phép
 *   - FR-20  UNIQUE (email)
 *   - FR-13  CHECK quantity >= 1; tồn kho không âm, không giữ quá số tồn; hai đơn tranh món cuối
 *   - FR-16  tạo đơn + giữ tồn kho cùng thành công hoặc cùng hoàn tác
 *
 * Test tự tạo dữ liệu riêng bằng UUID ngẫu nhiên và tự dọn, không phụ thuộc seed.
 * Chỉ chạy trên database dev/test. Không chạy với DATABASE_URL của production.
 */
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient, PaymentMethod, PaymentStatus } from '@prisma/client';

jest.setTimeout(30_000);

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || process.env.NODE_ENV === 'production' || !new URL(testUrl).pathname.endsWith('_test')) {
  throw new Error('Cần TEST_DATABASE_URL trỏ tới database kiểm thử có tên kết thúc bằng _test.');
}
const prisma = new PrismaClient({ datasourceUrl: testUrl });

const ids = {
  user: randomUUID(),
  otherUser: randomUUID(),
  product: randomUUID(),
  lastUnitProduct: randomUUID(),
  size: randomUUID(),
  topping: randomUUID(),
};

const shortCode = () => `T-${randomUUID().slice(0, 8)}`;

async function expectUniqueViolation(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code: 'P2002' });
}

function createOrder(overrides: Partial<Prisma.OrderUncheckedCreateInput> = {}) {
  return prisma.order.create({
    data: {
      orderCode: shortCode(),
      userId: ids.user,
      requestId: randomUUID(),
      totalAmount: 47000,
      items: {
        create: [
          {
            productId: ids.product,
            sizeId: ids.size,
            quantity: 1,
            sizePrice: 5000, lineTotal: 47000, unitPrice: 47000,
            toppings: { create: [{ toppingId: ids.topping, price: 7000 }] },
          },
        ],
      },
      ...overrides,
    },
  });
}

beforeAll(async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Không chạy integration test trên database production.');
  }
  await prisma.user.createMany({
    data: [
      { id: ids.user, email: `${ids.user}@test.local`, passwordHash: 'x', fullName: 'Test A' },
      { id: ids.otherUser, email: `${ids.otherUser}@test.local`, passwordHash: 'x', fullName: 'Test B' },
    ],
  });
  await prisma.size.create({ data: { id: ids.size, name: 'M-test', extraPrice: 5000 } });
  await prisma.topping.create({ data: { id: ids.topping, name: 'Topping-test', price: 7000 } });
  await prisma.product.createMany({
    data: [
      { id: ids.product, name: 'Món test', description: 'x', basePrice: 35000, stockQuantity: 5 },
      { id: ids.lastUnitProduct, name: 'Món test còn 1', description: 'x', basePrice: 35000, stockQuantity: 1 },
    ],
  });
});

afterAll(async () => {
  const userIds = [ids.user, ids.otherUser];
  const productIds = [ids.product, ids.lastUnitProduct];
  await prisma.payment.deleteMany({ where: { order: { userId: { in: userIds } } } });
  await prisma.order.deleteMany({ where: { userId: { in: userIds } } }); // order_items, order_item_toppings xóa theo
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.size.deleteMany({ where: { id: ids.size } });
  await prisma.topping.deleteMany({ where: { id: ids.topping } });
  await prisma.$disconnect();
});

describe('Tạo đơn: chống trùng và dữ liệu hợp lệ', () => {
  it('FR-18: cùng (userId, requestId) chỉ tạo được một đơn', async () => {
    const requestId = randomUUID();
    await createOrder({ requestId });
    await expectUniqueViolation(createOrder({ requestId }));
    expect(await prisma.order.count({ where: { userId: ids.user, requestId } })).toBe(1);
  });

  it('FR-18: cùng requestId nhưng khác khách hàng vẫn là hai đơn khác nhau', async () => {
    const requestId = randomUUID();
    await createOrder({ requestId });
    await expect(createOrder({ requestId, userId: ids.otherUser })).resolves.toBeDefined();
  });

  it('FR-06: mã đơn (order_code) là duy nhất', async () => {
    const orderCode = shortCode();
    await createOrder({ orderCode });
    await expectUniqueViolation(createOrder({ orderCode }));
  });

  it('FR-20: không đăng ký trùng email', async () => {
    await expectUniqueViolation(
      prisma.user.create({ data: { email: `${ids.user}@test.local`, passwordHash: 'x', fullName: 'Trùng' } }),
    );
  });

  it('đơn mới mặc định PENDING_PAYMENT và HELD (FR-06)', async () => {
    const order = await createOrder();
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.stockHoldStatus).toBe('HELD');
  });

  it('FR-13 (1): không lưu dòng món có số lượng 0', async () => {
    await expect(
      createOrder({ items: { create: [{ productId: ids.product, quantity: 0, sizePrice: 0, lineTotal: 35000, unitPrice: 35000 }] } }),
    ).rejects.toThrow(/check constraint|order_items_quantity_check/i);
  });
});

describe('Thanh toán: idempotency và thử lại', () => {
  it('FR-15: cùng (orderId, idempotencyKey) chỉ có một Payment', async () => {
    const order = await createOrder();
    const data = { orderId: order.id, idempotencyKey: randomUUID(), method: PaymentMethod.WALLET, amount: 47000 };
    await prisma.payment.create({ data });
    await expectUniqueViolation(prisma.payment.create({ data }));
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('FR-14: sau một lần FAILED, khóa mới trên cùng đơn tạo được Payment thứ hai', async () => {
    const order = await createOrder();
    await prisma.payment.create({
      data: {
        orderId: order.id,
        idempotencyKey: randomUUID(),
        method: PaymentMethod.CARD,
        amount: 47000,
        status: PaymentStatus.FAILED,
      },
    });
    await prisma.payment.create({
      data: { orderId: order.id, idempotencyKey: randomUUID(), method: PaymentMethod.CARD, amount: 47000 },
    });
    const payments = await prisma.payment.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
    expect(payments.map((p) => p.status)).toEqual(['FAILED', 'PROCESSING']);
  });

  it('cùng idempotencyKey ở hai đơn khác nhau không xung đột', async () => {
    const key = randomUUID();
    const [a, b] = [await createOrder(), await createOrder()];
    await prisma.payment.create({ data: { orderId: a.id, idempotencyKey: key, method: PaymentMethod.WALLET, amount: 1 } });
    await expect(
      prisma.payment.create({ data: { orderId: b.id, idempotencyKey: key, method: PaymentMethod.WALLET, amount: 1 } }),
    ).resolves.toBeDefined();
  });
});

describe('Tồn kho: ràng buộc và giao dịch', () => {
  it('FR-13 (6): giữ quá số tồn bị CHECK từ chối', async () => {
    await expect(
      prisma.product.update({ where: { id: ids.product }, data: { reservedQuantity: 6 } }),
    ).rejects.toThrow(/check constraint|products_stock_check/i);
  });

  it('tồn kho âm bị CHECK từ chối', async () => {
    await expect(
      prisma.product.update({ where: { id: ids.product }, data: { stockQuantity: -1 } }),
    ).rejects.toThrow(/check constraint|products_stock_check/i);
  });

  it('FR-16: lỗi sau khi ghi đơn thì hoàn tác cả đơn lẫn phần giữ tồn kho', async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: ids.product } });
    const requestId = randomUUID();

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.order.create({
          data: {
            orderCode: shortCode(),
            userId: ids.user,
            requestId,
            totalAmount: 35000,
            items: { create: [{ productId: ids.product, quantity: 1, sizePrice: 0, lineTotal: 35000, unitPrice: 35000 }] },
          },
        });
        await tx.product.update({ where: { id: ids.product }, data: { reservedQuantity: { increment: 1 } } });
        throw new Error('Lỗi giả lập sau khi ghi đơn');
      }),
    ).rejects.toThrow('Lỗi giả lập');

    expect(await prisma.order.count({ where: { userId: ids.user, requestId } })).toBe(0);
    const after = await prisma.product.findUniqueOrThrow({ where: { id: ids.product } });
    expect(after.reservedQuantity).toBe(before.reservedQuantity);
  });

  it('FR-13 (6): hai khách cùng đặt món chỉ còn 1, khóa dòng theo §5 cho đúng một đơn thắng', async () => {
    // Mô phỏng đúng mẫu trong backend-data-design §5: khóa dòng products, kiểm tra availableQuantity,
    // rồi mới tăng reserved_quantity. Service của Duy phải theo mẫu này; đây là bằng chứng mẫu đó đúng.
    const tryHoldOne = (userId: string) =>
      prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ stock_quantity: number; reserved_quantity: number }[]>`
          SELECT stock_quantity, reserved_quantity FROM products
          WHERE id = ${ids.lastUnitProduct}::uuid FOR UPDATE`;
        if (rows[0].stock_quantity - rows[0].reserved_quantity < 1) throw new Error('OUT_OF_STOCK');
        await tx.order.create({
          data: {
            orderCode: shortCode(),
            userId,
            requestId: randomUUID(),
            totalAmount: 35000,
            items: { create: [{ productId: ids.lastUnitProduct, quantity: 1, sizePrice: 0, lineTotal: 35000, unitPrice: 35000 }] },
          },
        });
        await tx.product.update({ where: { id: ids.lastUnitProduct }, data: { reservedQuantity: { increment: 1 } } });
      });

    const results = await Promise.allSettled([tryHoldOne(ids.user), tryHoldOne(ids.otherUser)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(String(rejected.reason)).toMatch(/OUT_OF_STOCK/);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: ids.lastUnitProduct } });
    expect(product.reservedQuantity).toBe(1);
    expect(await prisma.orderItem.count({ where: { productId: ids.lastUnitProduct } })).toBe(1);
  });
});

