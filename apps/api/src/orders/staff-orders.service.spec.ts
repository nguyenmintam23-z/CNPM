import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderWithItems } from './orders.service';
import { BUOC_KE_TIEP, StaffOrdersService, TRANG_THAI_HANG_CHO } from './staff-orders.service';

const D = (v: number) => new Prisma.Decimal(v);

function donMau(over: Partial<OrderWithItems> = {}): OrderWithItems {
  return {
    id: 'o1', orderCode: 'BL-261115-ABCDE', userId: 'u1', requestId: 'req-00001', status: 'CONFIRMED',
    stockHoldStatus: 'COMMITTED', totalAmount: D(52000), createdAt: new Date('2026-11-15T03:00:00Z'), updatedAt: new Date(),
    items: [{
      id: 'i1', orderId: 'o1', productId: 'p-ts', sizeId: 's-l', quantity: 2,
      sizePrice: D(10000), unitPrice: D(26000), lineTotal: D(52000),
      product: { name: 'Trà sữa' }, size: { name: 'L' },
      toppings: [{ id: 'x1', orderItemId: 'i1', toppingId: 't-tc', price: D(7000), topping: { name: 'Trân châu' } }],
    }],
    ...over,
  } as OrderWithItems;
}

describe('StaffOrdersService (FR-09, FR-10, FR-17)', () => {
  const findMany = jest.fn();
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const prisma = { order: { findMany, findFirst, findUnique, updateMany } } as unknown as PrismaService;
  let service: StaffOrdersService;

  beforeAll(() => Logger.overrideLogger(false));
  beforeEach(() => {
    jest.clearAllMocks();
    service = new StaffOrdersService(prisma);
  });

  describe('queue (FR-09)', () => {
    it('chỉ lấy đơn CONFIRMED, PREPARING, READY; đơn cũ trước', async () => {
      findMany.mockResolvedValue([donMau()]);
      const r = await service.queue();
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY'] } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }));
      expect(r[0]).toMatchObject({ orderCode: 'BL-261115-ABCDE', status: 'CONFIRMED' });
    });

    it('hàng chờ không có đơn chờ thanh toán, đã hủy hoặc đã hoàn tất (FR-09, FR-24)', () => {
      for (const s of ['PENDING_PAYMENT', 'CANCELLED', 'COMPLETED'] as OrderStatus[]) expect(TRANG_THAI_HANG_CHO).not.toContain(s);
    });
  });

  describe('detail (FR-09)', () => {
    it('trả món, size, topping, số lượng', async () => {
      findFirst.mockResolvedValue(donMau());
      const r = await service.detail('o1');
      expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o1', status: { in: TRANG_THAI_HANG_CHO } } }));
      expect(r.items[0]).toMatchObject({ productName: 'Trà sữa', sizeName: 'L', quantity: 2, toppings: [{ name: 'Trân châu' }] });
    });

    it('đơn ngoài hàng chờ hoặc không có → 404', async () => {
      findFirst.mockResolvedValue(null);
      await expect(service.detail('o1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('advance (FR-10, FR-17)', () => {
    it.each([
      ['CONFIRMED', 'PREPARING'],
      ['PREPARING', 'READY'],
      ['READY', 'COMPLETED'],
    ] as [OrderStatus, OrderStatus][])('%s → %s: ghi có điều kiện theo trạng thái cũ, trả đơn mới', async (from, to) => {
      updateMany.mockResolvedValue({ count: 1 });
      findUnique.mockResolvedValue(donMau({ status: to }));
      const r = await service.advance('staff1', 'o1', from, to);
      expect(updateMany).toHaveBeenCalledWith({ where: { id: 'o1', status: from }, data: { status: to } });
      expect(r.status).toBe(to);
    });

    it.each([
      ['CONFIRMED', 'READY', 'bỏ bước'],
      ['CONFIRMED', 'COMPLETED', 'bỏ hai bước'],
      ['READY', 'PREPARING', 'đi lùi'],
      ['PENDING_PAYMENT', 'CONFIRMED', 'đơn chưa thanh toán'],
      ['PENDING_PAYMENT', 'PREPARING', 'đơn chưa thanh toán vào chuẩn bị'],
      ['CANCELLED', 'PREPARING', 'đơn đã hủy'],
      ['COMPLETED', 'COMPLETED', 'đã hoàn tất'],
      ['CONFIRMED', 'CANCELLED', 'hủy từ quầy'],
    ] as [OrderStatus, OrderStatus, string][])('%s → %s (%s) → 400 INVALID_TRANSITION, không ghi', async (from, to) => {
      const err = await service.advance('staff1', 'o1', from, to).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'INVALID_TRANSITION' });
      expect(updateMany).not.toHaveBeenCalled();
    });

    it('bước kế tiếp chỉ có ba cặp hợp lệ', () => {
      expect(BUOC_KE_TIEP).toEqual({ CONFIRMED: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED' });
    });

    it('trạng thái đã đổi (nhân viên khác cập nhật trước) → 409 ORDER_STATUS_CHANGED kèm đơn mới nhất (FR-17)', async () => {
      updateMany.mockResolvedValue({ count: 0 });
      findUnique.mockResolvedValue(donMau({ status: 'PREPARING' }));
      const err = await service.advance('staff1', 'o1', 'CONFIRMED', 'PREPARING').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({ code: 'ORDER_STATUS_CHANGED', order: { status: 'PREPARING' } });
    });

    it('đơn thật ra chưa thanh toán (client gửi from cũ) → 409 kèm trạng thái thật, không ghi gì (FR-10)', async () => {
      updateMany.mockResolvedValue({ count: 0 });
      findUnique.mockResolvedValue(donMau({ status: 'PENDING_PAYMENT', stockHoldStatus: 'HELD' }));
      const err = await service.advance('staff1', 'o1', 'CONFIRMED', 'PREPARING').catch((e: unknown) => e);
      expect((err as ConflictException).getResponse()).toMatchObject({ order: { status: 'PENDING_PAYMENT' } });
    });

    it('không có đơn → 404', async () => {
      updateMany.mockResolvedValue({ count: 0 });
      findUnique.mockResolvedValue(null);
      await expect(service.advance('staff1', 'o1', 'CONFIRMED', 'PREPARING')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
