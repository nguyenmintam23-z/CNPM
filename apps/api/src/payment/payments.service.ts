import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, PaymentService } from './payment.service';

export const MSG_DON_KHONG_THANH_TOAN = 'Đơn không ở trạng thái chờ thanh toán';
export const MSG_DANG_XU_LY = 'Đơn đang có một lần thanh toán đang xử lý';
export const MSG_TON_KHONG_HOP_LE = 'Tồn kho của đơn không ở trạng thái có thể thanh toán';

export interface PaymentResult {
  payment: {
    id: string;
    method: string;
    status: string;
    amount: number;
    createdAt: string;
    completedAt: string | null;
    /** Lý do thất bại để báo khách (FR-14); chỉ có khi FAILED. */
    failureReason?: string;
  };
  order: { id: string; orderCode: string; status: string; stockHoldStatus: string };
}

interface OrderRow {
  id: string;
  user_id: string;
  order_code: string;
  status: string;
  stock_hold_status: string;
  total_amount: Prisma.Decimal;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/**
 * Thanh toán đơn (PaymentModule; backend-data-design §5; backend-operations §2; Sequence Checkout;
 * UC-01 bước 9–12, A2, E5–E7; FR-07, FR-14, FR-15).
 *
 * 1. Bắt đầu (một transaction): khóa dòng Order → kiểm tra chủ đơn → tra Payment theo (orderId, idempotencyKey)
 *    TRƯỚC khi xét trạng thái đơn → nếu mới: đơn phải PENDING_PAYMENT, chưa có Payment PROCESSING;
 *    tồn RELEASED (thử lại sau FAILED) thì giữ lại tồn → tạo Payment PROCESSING → commit.
 * 2. Gọi PaymentService NGOÀI transaction, sau commit.
 * 3. Áp dụng kết quả (một transaction): khóa Order, đọc lại Payment; chỉ khi còn PROCESSING mới áp dụng,
 *    nên chốt hoặc giải phóng tồn đúng một lần.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly simulator: PaymentService,
  ) {}

  async pay(userId: string, orderId: string, method: PaymentMethod, idempotencyKey: string): Promise<PaymentResult> {
    let payment: Payment;
    try {
      payment = await this.prisma.$transaction((tx) => this.start(tx, userId, orderId, method, idempotencyKey));
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Hai yêu cầu cùng khóa đến đồng thời (E7): bản thua hoàn tác cả phần giữ lại tồn, đọc Payment của bản thắng.
      payment = await this.prisma.payment.findUniqueOrThrow({ where: { orderId_idempotencyKey: { orderId, idempotencyKey } } });
      this.logger.log({ event: 'payment_duplicate_request', paymentId: payment.id, orderId });
    }
    if (payment.status === 'PROCESSING') payment = await this.resolve(payment);
    return this.view(payment);
  }

  /** Bước 1: tạo Payment PROCESSING, hoặc trả Payment đã có của cùng khóa (gửi lại, E6/E7). */
  private async start(
    tx: Prisma.TransactionClient, userId: string, orderId: string, method: PaymentMethod, idempotencyKey: string,
  ): Promise<Payment> {
    const [order] = await tx.$queryRaw<OrderRow[]>`
      SELECT id::text AS id, user_id::text AS user_id, order_code, status::text AS status,
             stock_hold_status::text AS stock_hold_status, total_amount
      FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.user_id !== userId) throw new ForbiddenException('Không có quyền thanh toán đơn này');

    const daCo = await tx.payment.findUnique({ where: { orderId_idempotencyKey: { orderId, idempotencyKey } } });
    if (daCo) return daCo; // tra khóa trước khi xét trạng thái đơn: gửi lại sau khi đã thành công vẫn nhận kết quả cũ

    if (order.status !== 'PENDING_PAYMENT') {
      throw new ConflictException({ statusCode: 409, error: 'Conflict', message: MSG_DON_KHONG_THANH_TOAN, code: 'ORDER_NOT_PAYABLE', orderStatus: order.status });
    }
    const dangXuLy = await tx.payment.findFirst({ where: { orderId, status: 'PROCESSING' } });
    if (dangXuLy) {
      throw new ConflictException({ statusCode: 409, error: 'Conflict', message: MSG_DANG_XU_LY, code: 'PAYMENT_IN_PROGRESS' });
    }
    if (order.stock_hold_status === 'RELEASED') {
      // Thử lại sau FAILED (A2.4): giữ lại tồn; hết hàng → 409 kèm món thiếu, không tạo Payment (E5).
      await this.inventory.rehold(tx, await this.items(tx, orderId));
      await tx.order.update({ where: { id: orderId }, data: { stockHoldStatus: 'HELD' } });
    } else if (order.stock_hold_status !== 'HELD') {
      throw new ConflictException({ statusCode: 409, error: 'Conflict', message: MSG_TON_KHONG_HOP_LE, code: 'STOCK_NOT_PAYABLE' });
    }
    const p = await tx.payment.create({
      data: { orderId, idempotencyKey, method, status: 'PROCESSING', amount: order.total_amount },
    });
    this.logger.log({ event: 'payment_created', paymentId: p.id, orderId, method });
    return p;
  }

  /** Bước 2 + 3: hỏi bộ mô phỏng ngoài transaction; có kết quả cuối thì áp dụng đúng một lần. */
  private async resolve(payment: Payment): Promise<Payment> {
    const kq = this.simulator.process({
      orderId: payment.orderId, idempotencyKey: payment.idempotencyKey, method: payment.method, startedAt: payment.createdAt,
    });
    if (kq.status === 'PROCESSING') {
      this.logger.warn({ event: 'payment_result_pending', paymentId: payment.id, orderId: payment.orderId, paymentStatus: 'PROCESSING' });
      return payment;
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${payment.orderId}::uuid FOR UPDATE`;
      const hienTai = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      if (hienTai.status !== 'PROCESSING') return hienTai; // yêu cầu khác đã áp dụng trước: không làm lại
      const lines = await this.items(tx, payment.orderId);
      const now = new Date();
      if (kq.status === 'SUCCEEDED') {
        await this.inventory.commit(tx, lines);
        await tx.order.update({ where: { id: payment.orderId }, data: { status: 'CONFIRMED', stockHoldStatus: 'COMMITTED' } });
      } else {
        await this.inventory.release(tx, lines);
        await tx.order.update({ where: { id: payment.orderId }, data: { stockHoldStatus: 'RELEASED' } });
      }
      const xong = await tx.payment.update({ where: { id: payment.id }, data: { status: kq.status, completedAt: now } });
      this.logger.log({ event: 'payment_result_applied', paymentId: payment.id, orderId: payment.orderId, paymentStatus: kq.status });
      return xong;
    });
  }

  private items(tx: Prisma.TransactionClient, orderId: string) {
    return tx.orderItem.findMany({ where: { orderId }, select: { productId: true, quantity: true } });
  }

  private async view(p: Payment): Promise<PaymentResult> {
    const o = await this.prisma.order.findUniqueOrThrow({
      where: { id: p.orderId }, select: { id: true, orderCode: true, status: true, stockHoldStatus: true },
    });
    const failureReason = p.status === 'FAILED'
      ? this.simulator.process({ orderId: p.orderId, idempotencyKey: p.idempotencyKey, method: p.method, startedAt: new Date(0) }).failureReason
      : undefined;
    return {
      payment: {
        id: p.id,
        method: p.method,
        status: p.status,
        amount: p.amount.toNumber(),
        createdAt: p.createdAt.toISOString(),
        completedAt: p.completedAt?.toISOString() ?? null,
        ...(failureReason ? { failureReason } : {}),
      },
      order: o,
    };
  }
}
