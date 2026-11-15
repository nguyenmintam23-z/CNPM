import { ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from './payment.service';
import { PaymentsService } from './payments.service';

const D = (v: number) => new Prisma.Decimal(v);
const ORDER = { id: 'o1', user_id: 'u1', order_code: 'BL-261115-ABCDE', status: 'PENDING_PAYMENT', stock_hold_status: 'HELD', total_amount: D(52000) };
const pay = (over: Partial<Payment> = {}): Payment => ({
  id: 'pay1', orderId: 'o1', idempotencyKey: 'key-0001', method: 'WALLET', status: 'PROCESSING', amount: D(52000),
  createdAt: new Date('2026-11-15T03:00:00Z'), updatedAt: new Date(), completedAt: null, ...over,
} as Payment);
const LINES = [{ productId: 'p1', quantity: 2 }];

describe('PaymentsService.pay (FR-07, FR-14, FR-15; backend-data-design §5)', () => {
  let orderRow: typeof ORDER | undefined;
  const tx = {
    $queryRaw: jest.fn(async () => (orderRow ? [orderRow] : [])),
    payment: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
    order: { update: jest.fn() },
    orderItem: { findMany: jest.fn(async () => LINES) },
  };
  const $transaction: jest.Mock = jest.fn((fn: (t: typeof tx) => unknown) => fn(tx));
  const prisma = {
    $transaction,
    payment: { findUniqueOrThrow: jest.fn() },
    order: { findUniqueOrThrow: jest.fn(async () => ({ id: 'o1', orderCode: 'BL-261115-ABCDE', status: 'X', stockHoldStatus: 'Y' })) },
  } as unknown as PrismaService & { payment: { findUniqueOrThrow: jest.Mock } };
  const inventory = { rehold: jest.fn(), commit: jest.fn(), release: jest.fn() } as unknown as Record<'rehold' | 'commit' | 'release', jest.Mock> & InventoryService;
  const simulator = { process: jest.fn() } as unknown as PaymentService & { process: jest.Mock };
  let service: PaymentsService;

  beforeAll(() => Logger.overrideLogger(false));
  beforeEach(() => {
    jest.clearAllMocks();
    orderRow = { ...ORDER };
    tx.payment.findUnique.mockResolvedValue(null);
    tx.payment.findFirst.mockResolvedValue(null);
    tx.payment.create.mockImplementation(async ({ data }) => pay({ method: data.method }));
    tx.payment.findUniqueOrThrow.mockResolvedValue(pay());
    tx.payment.update.mockImplementation(async ({ data }) => pay({ status: data.status, completedAt: data.completedAt }));
    simulator.process.mockReturnValue({ status: 'SUCCEEDED' });
    service = new PaymentsService(prisma, inventory, simulator);
  });

  it('thành công: tạo Payment PROCESSING số tiền = tổng đơn, rồi chốt tồn, đơn CONFIRMED/COMMITTED (FR-07)', async () => {
    const r = await service.pay('u1', 'o1', 'CARD', 'key-0001');
    expect(tx.payment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: 'PROCESSING', amount: D(52000), method: 'CARD' }) });
    expect(inventory.commit).toHaveBeenCalledWith(tx, LINES);
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { status: 'CONFIRMED', stockHoldStatus: 'COMMITTED' } });
    expect(r.payment.status).toBe('SUCCEEDED');
    expect($transaction).toHaveBeenCalledTimes(2); // bắt đầu và áp dụng kết quả là hai transaction, gọi mô phỏng ở giữa
    expect(simulator.process.mock.invocationCallOrder[0]).toBeGreaterThan(tx.payment.create.mock.invocationCallOrder[0]);
  });

  it('thất bại: giải phóng tồn, đơn giữ PENDING_PAYMENT với tồn RELEASED, trả lý do (FR-14)', async () => {
    simulator.process.mockReturnValue({ status: 'FAILED', failureReason: 'Ví từ chối' });
    const r = await service.pay('u1', 'o1', 'WALLET', 'key-0001');
    expect(inventory.release).toHaveBeenCalledWith(tx, LINES);
    expect(inventory.commit).not.toHaveBeenCalled();
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { stockHoldStatus: 'RELEASED' } });
    expect(r.payment).toMatchObject({ status: 'FAILED', failureReason: 'Ví từ chối' });
  });

  it('chưa có kết quả: trả PROCESSING, không mở transaction áp dụng (E6)', async () => {
    simulator.process.mockReturnValue({ status: 'PROCESSING' });
    const r = await service.pay('u1', 'o1', 'WALLET', 'key-0001');
    expect(r.payment.status).toBe('PROCESSING');
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('gửi lại cùng khóa: không tạo Payment mới, tra khóa TRƯỚC khi xét trạng thái đơn (E7)', async () => {
    orderRow = { ...ORDER, status: 'CONFIRMED' };
    tx.payment.findUnique.mockResolvedValue(pay({ status: 'SUCCEEDED' }));
    const r = await service.pay('u1', 'o1', 'WALLET', 'key-0001');
    expect(r.payment.status).toBe('SUCCEEDED');
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(simulator.process).not.toHaveBeenCalled();
  });

  it('kết quả đã được yêu cầu khác áp dụng trước: không chốt tồn lần hai (FR-15)', async () => {
    tx.payment.findUniqueOrThrow.mockResolvedValue(pay({ status: 'SUCCEEDED' }));
    await service.pay('u1', 'o1', 'WALLET', 'key-0001');
    expect(inventory.commit).not.toHaveBeenCalled();
    expect(tx.payment.update).not.toHaveBeenCalled();
  });

  it('hai yêu cầu cùng khóa đồng thời: bản thua gặp UNIQUE → đọc Payment của bản thắng', async () => {
    $transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    prisma.payment.findUniqueOrThrow.mockResolvedValue(pay({ status: 'SUCCEEDED' }));
    const r = await service.pay('u1', 'o1', 'WALLET', 'key-0001');
    expect(r.payment.status).toBe('SUCCEEDED');
  });

  it('thử lại sau FAILED (tồn RELEASED): giữ lại tồn rồi mới tạo Payment mới (A2.4)', async () => {
    orderRow = { ...ORDER, stock_hold_status: 'RELEASED' };
    await service.pay('u1', 'o1', 'WALLET', 'key-0002');
    expect(inventory.rehold).toHaveBeenCalledWith(tx, LINES);
    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { stockHoldStatus: 'HELD' } });
    expect(inventory.rehold.mock.invocationCallOrder[0]).toBeLessThan(tx.payment.create.mock.invocationCallOrder[0]);
  });

  it('thử lại khi hết hàng: 409 từ giữ lại tồn, không tạo Payment (E5)', async () => {
    orderRow = { ...ORDER, stock_hold_status: 'RELEASED' };
    inventory.rehold.mockRejectedValueOnce(new ConflictException('hết hàng'));
    await expect(service.pay('u1', 'o1', 'WALLET', 'key-0002')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.payment.create).not.toHaveBeenCalled();
  });

  it.each([
    ['không có đơn', () => { orderRow = undefined; }, NotFoundException],
    ['đơn của khách khác', () => { orderRow = { ...ORDER, user_id: 'u2' }; }, ForbiddenException],
    ['đơn đã xác nhận', () => { orderRow = { ...ORDER, status: 'CONFIRMED' }; }, ConflictException],
    ['đơn đã hủy', () => { orderRow = { ...ORDER, status: 'CANCELLED' }; }, ConflictException],
    ['đang có Payment PROCESSING khác', () => { tx.payment.findFirst.mockResolvedValue(pay({ idempotencyKey: 'key-khac' })); }, ConflictException],
  ])('%s → từ chối, không tạo Payment', async (_, setup, Loi) => {
    setup();
    await expect(service.pay('u1', 'o1', 'WALLET', 'key-0003')).rejects.toBeInstanceOf(Loi);
    expect(tx.payment.create).not.toHaveBeenCalled();
  });
});
