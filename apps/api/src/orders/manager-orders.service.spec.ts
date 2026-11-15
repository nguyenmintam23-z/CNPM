import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MSG_THAT_BAI } from '../payment/payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ManagerOrdersService } from './manager-orders.service';

const D = (v: number) => new Prisma.Decimal(v);

const donMau = (over: Record<string, unknown> = {}) => ({
  id: 'o1', orderCode: 'BL-261115-ABCDE', userId: 'u1', requestId: 'req-00001', status: 'PENDING_PAYMENT',
  stockHoldStatus: 'RELEASED', totalAmount: D(10000), createdAt: new Date('2026-11-15T03:00:00Z'), updatedAt: new Date(),
  items: [{
    id: 'i1', orderId: 'o1', productId: 'p-ns', sizeId: null, quantity: 1,
    sizePrice: D(0), unitPrice: D(10000), lineTotal: D(10000),
    product: { name: 'Nước suối' }, size: null, toppings: [],
  }],
  ...over,
});

const traMau = (over: Record<string, unknown> = {}) => ({
  id: 'p1', orderId: 'o1', idempotencyKey: 'k1', method: 'WALLET', status: 'FAILED', amount: D(10000),
  createdAt: new Date('2026-11-15T03:01:00Z'), updatedAt: new Date(), completedAt: new Date('2026-11-15T03:01:01Z'),
  ...over,
});

describe('ManagerOrdersService (FR-11)', () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const findUnique = jest.fn();
  const $transaction = jest.fn((ops: Promise<unknown>[]) => Promise.all(ops));
  const prisma = { order: { findMany, count, findUnique }, $transaction } as unknown as PrismaService;
  let service: ManagerOrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ManagerOrdersService(prisma);
  });

  describe('list', () => {
    it('không lọc: lấy mọi đơn của cửa hàng, mới nhất trước, có tổng số', async () => {
      findMany.mockResolvedValue([{ ...donMau(), payments: [{ status: 'FAILED' }] }]);
      count.mockResolvedValue(1);
      const r = await service.list(undefined, 1, 20);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 0, take: 20 }));
      expect(count).toHaveBeenCalledWith({ where: {} });
      expect(r).toMatchObject({ page: 1, pageSize: 20, total: 1 });
      expect(r.items[0]).toMatchObject({ orderCode: 'BL-261115-ABCDE', status: 'PENDING_PAYMENT', latestPaymentStatus: 'FAILED' });
      expect(r.items[0]).not.toHaveProperty('payments');
    });

    it('lọc Chờ thanh toán: chỉ truy vấn đơn PENDING_PAYMENT (FR-11)', async () => {
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);
      await service.list('PENDING_PAYMENT', 2, 10);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'PENDING_PAYMENT' }, skip: 10, take: 10 }));
      expect(count).toHaveBeenCalledWith({ where: { status: 'PENDING_PAYMENT' } });
    });

    it('đơn chưa thanh toán lần nào: latestPaymentStatus = null', async () => {
      findMany.mockResolvedValue([{ ...donMau({ stockHoldStatus: 'HELD' }), payments: [] }]);
      count.mockResolvedValue(1);
      const r = await service.list(undefined, 1, 20);
      expect(r.items[0].latestPaymentStatus).toBeNull();
    });
  });

  describe('detail', () => {
    it('đơn có lần thanh toán thất bại: thấy kết quả và lý do của lần đó (FR-11)', async () => {
      findUnique.mockResolvedValue({ ...donMau(), payments: [traMau(), traMau({ id: 'p2', status: 'SUCCEEDED', method: 'CARD' })] });
      const r = await service.detail('o1');
      expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o1' } }));
      expect(r.payments).toEqual([
        expect.objectContaining({ id: 'p1', method: 'WALLET', status: 'FAILED', amount: 10000, failureReason: MSG_THAT_BAI.WALLET }),
        expect.objectContaining({ id: 'p2', status: 'SUCCEEDED' }),
      ]);
      expect(r.payments[1]).not.toHaveProperty('failureReason');
      expect(r.items[0]).toMatchObject({ productName: 'Nước suối', quantity: 1 });
    });

    it('không có đơn → 404', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.detail('o1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
