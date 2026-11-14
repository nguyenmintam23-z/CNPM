import { ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PricingService } from '../catalog/pricing.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { cartSignature, MSG_REQUEST_ID_DA_DUNG, newOrderCode, OrdersService, OrderWithItems } from './orders.service';

const D = (v: number) => new Prisma.Decimal(v);

function donMau(over: Partial<OrderWithItems> = {}): OrderWithItems {
  return {
    id: 'o1', orderCode: 'BL-261115-ABCDE', userId: 'u1', requestId: 'req-00001', status: 'PENDING_PAYMENT',
    stockHoldStatus: 'HELD', totalAmount: D(52000), createdAt: new Date('2026-11-15T03:00:00Z'), updatedAt: new Date(),
    items: [{
      id: 'i1', orderId: 'o1', productId: 'p-ts', sizeId: 's-l', quantity: 1,
      sizePrice: D(10000), unitPrice: D(52000), lineTotal: D(52000),
      product: { name: 'Trà sữa' }, size: { name: 'L' },
      toppings: [{ id: 'x1', orderItemId: 'i1', toppingId: 't-tc', price: D(7000), topping: { name: 'Trân châu' } }],
    }],
    ...over,
  } as OrderWithItems;
}
const GIO = [{ productId: 'p-ts', sizeId: 's-l', toppingIds: ['t-tc'], quantity: 1 }];
const p2002 = (target: string[]) => new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x', meta: { target } });

describe('OrdersService.checkout (FR-06, FR-16, FR-18)', () => {
  const findUnique = jest.fn();
  const create = jest.fn();
  const tx = { order: { create } };
  const $transaction: jest.Mock = jest.fn((fn: (t: unknown) => unknown) => fn(tx));
  const prisma = { order: { findUnique }, $transaction } as unknown as PrismaService;
  const pricing = { price: jest.fn() } as unknown as PricingService & { price: jest.Mock };
  const inventory = { lockProducts: jest.fn(), hold: jest.fn() } as unknown as InventoryService & { lockProducts: jest.Mock; hold: jest.Mock };
  let service: OrdersService;

  beforeAll(() => Logger.overrideLogger(false));
  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(prisma, pricing, inventory);
    inventory.lockProducts.mockResolvedValue([]);
    pricing.price.mockResolvedValue({
      totalAmount: D(52000),
      lines: [{ productId: 'p-ts', sizeId: 's-l', quantity: 1, sizePrice: D(10000), unitPrice: D(52000), lineTotal: D(52000),
        toppings: [{ id: 't-tc', name: 'Trân châu', price: D(7000) }] }],
    });
  });

  it('tạo đơn mới: khóa tồn → tính giá → giữ tồn → ghi đơn, trong một transaction; trả created = true', async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue(donMau());
    const r = await service.checkout('u1', 'req-00001', GIO);

    expect(r.created).toBe(true);
    expect(r.order).toMatchObject({ orderCode: 'BL-261115-ABCDE', status: 'PENDING_PAYMENT', stockHoldStatus: 'HELD', totalAmount: 52000 });
    expect(r.order.items[0]).toMatchObject({ sizePrice: 10000, unitPrice: 52000, lineTotal: 52000, toppings: [{ id: 't-tc', price: 7000 }] });
    expect($transaction).toHaveBeenCalledTimes(1);
    const thuTu = [inventory.lockProducts, pricing.price, inventory.hold, create].map((m) => m.mock.invocationCallOrder[0]);
    expect(thuTu).toEqual([...thuTu].sort((a, b) => a - b));
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'u1', requestId: 'req-00001', totalAmount: D(52000) });
    expect(data.orderCode).toMatch(/^BL-\d{6}-[A-Z2-9]{5}$/);
    expect(data.items.create[0]).toMatchObject({ sizePrice: D(10000), unitPrice: D(52000), lineTotal: D(52000) });
  });

  it('gửi lại cùng requestId, cùng nội dung (thứ tự topping khác) → trả đơn cũ, không mở transaction (E4)', async () => {
    findUnique.mockResolvedValue(donMau());
    const r = await service.checkout('u1', 'req-00001', [{ ...GIO[0], toppingIds: ['t-tc'] }]);
    expect(r).toMatchObject({ created: false, order: { id: 'o1' } });
    expect($transaction).not.toHaveBeenCalled();
  });

  it('cùng requestId nhưng khác nội dung → 409 REQUEST_ID_REUSED, không tạo đơn', async () => {
    findUnique.mockResolvedValue(donMau());
    const err = await service.checkout('u1', 'req-00001', [{ ...GIO[0], quantity: 2 }]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ message: MSG_REQUEST_ID_DA_DUNG, code: 'REQUEST_ID_REUSED' });
    expect($transaction).not.toHaveBeenCalled();
  });

  it('hai yêu cầu cùng requestId chạy song song: bản thua gặp UNIQUE (user_id, request_id) → trả đơn của bản thắng (FR-18)', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(donMau());
    $transaction.mockRejectedValueOnce(p2002(['user_id', 'request_id']));
    await expect(service.checkout('u1', 'req-00001', GIO)).resolves.toMatchObject({ created: false, order: { id: 'o1' } });
  });

  it('trùng mã đơn ngẫu nhiên → thử lại với mã khác', async () => {
    findUnique.mockResolvedValue(null);
    $transaction.mockRejectedValueOnce(p2002(['order_code']));
    create.mockResolvedValue(donMau());
    await expect(service.checkout('u1', 'req-00001', GIO)).resolves.toMatchObject({ created: true });
    expect($transaction).toHaveBeenCalledTimes(2);
  });

  it('lỗi trong transaction (ví dụ thiếu hàng) được ném ra nguyên vẹn, không nuốt lỗi (FR-16)', async () => {
    findUnique.mockResolvedValue(null);
    inventory.hold.mockRejectedValueOnce(new ConflictException('thiếu hàng'));
    await expect(service.checkout('u1', 'req-00001', GIO)).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('Hàm hỗ trợ', () => {
  it('chữ ký giỏ không phụ thuộc thứ tự dòng và thứ tự topping', () => {
    const a = cartSignature([{ productId: 'x', toppingIds: ['2', '1'], quantity: 1 }, { productId: 'y', quantity: 2 }]);
    const b = cartSignature([{ productId: 'y', quantity: 2 }, { productId: 'x', toppingIds: ['1', '2'], quantity: 1 }]);
    expect(a).toBe(b);
    expect(cartSignature([{ productId: 'y', quantity: 3 }])).not.toBe(cartSignature([{ productId: 'y', quantity: 2 }]));
  });

  it('mã đơn dạng BL-yyMMdd-XXXXX, không có 0/O/1/I', () => {
    for (let i = 0; i < 200; i++) expect(newOrderCode(new Date('2026-11-15T10:00:00Z'))).toMatch(/^BL-261115-[A-HJ-NP-Z2-9]{5}$/);
  });

  it('ngày trong mã đơn theo giờ Việt Nam: 17:30 UTC ngày 14 là ngày 15 ở Việt Nam', () => {
    expect(newOrderCode(new Date('2026-11-14T17:30:00Z'))).toMatch(/^BL-261115-/);
    expect(newOrderCode(new Date('2026-11-14T16:59:00Z'))).toMatch(/^BL-261114-/);
  });
});
