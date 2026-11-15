import { ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { MSG_DANG_THANH_TOAN, OrdersService, OrderWithItems } from './orders.service';

const D = (v: number) => new Prisma.Decimal(v);

function donMau(over: Partial<OrderWithItems> = {}): OrderWithItems {
  return {
    id: 'o1', orderCode: 'BL-261115-ABCDE', userId: 'u1', requestId: 'req-00001', status: 'PENDING_PAYMENT',
    stockHoldStatus: 'HELD', totalAmount: D(52000), createdAt: new Date('2026-11-15T03:00:00Z'), updatedAt: new Date(),
    items: [{
      id: 'i1', orderId: 'o1', productId: 'p-ts', sizeId: null, quantity: 2,
      sizePrice: D(0), unitPrice: D(26000), lineTotal: D(52000),
      product: { name: 'Trà sữa' }, size: null, toppings: [],
    }],
    ...over,
  } as OrderWithItems;
}

describe('OrdersService lịch sử, chi tiết (FR-08), hủy đơn (FR-23, FR-24)', () => {
  const findUnique = jest.fn();
  const findMany = jest.fn();
  const count = jest.fn();
  const orderUpdate = jest.fn();
  const paymentFindFirst = jest.fn();
  const queryRaw = jest.fn();
  const findUniqueOrThrow = jest.fn();
  const tx = {
    $queryRaw: queryRaw,
    order: { findUniqueOrThrow, update: orderUpdate },
    payment: { findFirst: paymentFindFirst },
  };
  const $transaction: jest.Mock = jest.fn((arg: unknown) =>
    typeof arg === 'function' ? (arg as (t: unknown) => unknown)(tx) : Promise.all(arg as Promise<unknown>[]));
  const prisma = { order: { findUnique, findMany, count }, $transaction } as unknown as PrismaService;
  const release = jest.fn();
  const inventory = { release } as unknown as InventoryService;
  let service: OrdersService;

  beforeAll(() => Logger.overrideLogger(false));
  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(prisma, {} as never, inventory);
    queryRaw.mockResolvedValue([{ user_id: 'u1' }]);
    paymentFindFirst.mockResolvedValue(null);
    release.mockResolvedValue(undefined);
  });

  describe('list', () => {
    it('chỉ lấy đơn của người dùng, mới nhất trước, đúng trang và có tổng số', async () => {
      findMany.mockResolvedValue([donMau()]);
      count.mockResolvedValue(21);
      const r = await service.list('u1', 2, 20);

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'u1' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 20, take: 20,
      }));
      expect(count).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(r).toMatchObject({ page: 2, pageSize: 20, total: 21 });
      expect(r.items[0]).toMatchObject({ orderCode: 'BL-261115-ABCDE', totalAmount: 52000 });
    });
  });

  describe('detail', () => {
    it('trả chi tiết khi đúng chủ đơn', async () => {
      findUnique.mockResolvedValue(donMau());
      const r = await service.detail('u1', 'o1');
      expect(r.items[0]).toMatchObject({ productName: 'Trà sữa', quantity: 2, lineTotal: 52000 });
    });

    it('không có đơn → 404', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.detail('u1', 'o1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('đơn của người khác → 403', async () => {
      findUnique.mockResolvedValue(donMau({ userId: 'u2' }));
      await expect(service.detail('u1', 'o1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it('đơn chờ thanh toán, tồn đang giữ → giải phóng tồn, đặt CANCELLED và RELEASED', async () => {
      findUniqueOrThrow.mockResolvedValue(donMau());
      orderUpdate.mockResolvedValue(donMau({ status: 'CANCELLED', stockHoldStatus: 'RELEASED' }));
      const r = await service.cancel('u1', 'o1');

      expect(r).toMatchObject({ status: 'CANCELLED', stockHoldStatus: 'RELEASED' });
      expect(release).toHaveBeenCalledWith(tx, [{ productId: 'p-ts', quantity: 2 }]);
      expect(orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'CANCELLED', stockHoldStatus: 'RELEASED' } }));
    });

    it('khóa dòng đơn trước khi kiểm tra payment, rồi mới giải phóng tồn', async () => {
      findUniqueOrThrow.mockResolvedValue(donMau());
      orderUpdate.mockResolvedValue(donMau({ status: 'CANCELLED', stockHoldStatus: 'RELEASED' }));
      await service.cancel('u1', 'o1');
      expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(paymentFindFirst.mock.invocationCallOrder[0]);
      expect(paymentFindFirst.mock.invocationCallOrder[0]).toBeLessThan(release.mock.invocationCallOrder[0]);
    });

    it('sau thanh toán FAILED (tồn đã RELEASED) → hủy nhưng không giải phóng tồn lần nữa', async () => {
      findUniqueOrThrow.mockResolvedValue(donMau({ stockHoldStatus: 'RELEASED' }));
      orderUpdate.mockResolvedValue(donMau({ status: 'CANCELLED', stockHoldStatus: 'RELEASED' }));
      await service.cancel('u1', 'o1');
      expect(release).not.toHaveBeenCalled();
    });

    it('đang có Payment PROCESSING → 409 PAYMENT_IN_PROGRESS, không đổi gì', async () => {
      findUniqueOrThrow.mockResolvedValue(donMau());
      paymentFindFirst.mockResolvedValue({ id: 'p1', status: 'PROCESSING' });
      const err = await service.cancel('u1', 'o1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({ code: 'PAYMENT_IN_PROGRESS', message: MSG_DANG_THANH_TOAN });
      expect(release).not.toHaveBeenCalled();
      expect(orderUpdate).not.toHaveBeenCalled();
    });

    it('đơn đã xác nhận (CONFIRMED) → 409 ORDER_NOT_CANCELLABLE', async () => {
      findUniqueOrThrow.mockResolvedValue(donMau({ status: 'CONFIRMED', stockHoldStatus: 'COMMITTED' }));
      const err = await service.cancel('u1', 'o1').catch((e: unknown) => e);
      expect((err as ConflictException).getResponse()).toMatchObject({ code: 'ORDER_NOT_CANCELLABLE', orderStatus: 'CONFIRMED' });
      expect(release).not.toHaveBeenCalled();
    });

    it('đã hủy trước đó → trả lại đơn, không giải phóng tồn lần nữa', async () => {
      findUniqueOrThrow.mockResolvedValue(donMau({ status: 'CANCELLED', stockHoldStatus: 'RELEASED' }));
      const r = await service.cancel('u1', 'o1');
      expect(r.status).toBe('CANCELLED');
      expect(release).not.toHaveBeenCalled();
      expect(orderUpdate).not.toHaveBeenCalled();
    });

    it('đơn không tồn tại → 404; đơn của người khác → 403', async () => {
      queryRaw.mockResolvedValueOnce([]);
      await expect(service.cancel('u1', 'o1')).rejects.toBeInstanceOf(NotFoundException);
      queryRaw.mockResolvedValueOnce([{ user_id: 'u2' }]);
      await expect(service.cancel('u1', 'o1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
