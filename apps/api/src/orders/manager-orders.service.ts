import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Payment, Prisma } from '@prisma/client';
import { MSG_THAT_BAI } from '../payment/payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_INCLUDE, OrderView, toOrderView } from './orders.service';

/** Một lần thanh toán trong chi tiết đơn của quản lý (FR-11: thấy kết quả lần thanh toán thất bại). */
export interface ManagerPaymentView {
  id: string;
  method: string;
  status: string;
  amount: number;
  createdAt: string;
  completedAt: string | null;
  /** Lý do thất bại như khách đã thấy (FR-14); chỉ có khi FAILED. */
  failureReason?: string;
}

export interface ManagerOrderListItem extends OrderView {
  /** Trạng thái lần thanh toán gần nhất, null nếu chưa thanh toán lần nào [Đề xuất]. */
  latestPaymentStatus: string | null;
}

export interface ManagerOrderDetail extends OrderView {
  /** Các lần thanh toán, cũ trước. */
  payments: ManagerPaymentView[];
}

function toPaymentView(p: Payment): ManagerPaymentView {
  return {
    id: p.id,
    method: p.method,
    status: p.status,
    amount: p.amount.toNumber(),
    createdAt: p.createdAt.toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
    ...(p.status === 'FAILED' ? { failureReason: MSG_THAT_BAI[p.method] } : {}),
  };
}

/**
 * Tra cứu đơn cho quản lý (OrdersModule, backend-data-design §3; FR-11, Should).
 * Chỉ đọc: thấy mọi đơn của cửa hàng, gồm đơn chờ thanh toán và đơn có lần thanh toán thất bại; lọc theo trạng thái.
 * OrdersModule đọc bảng payments như khi hủy đơn (backend-data-design §3), không gọi PaymentModule.
 */
@Injectable()
export class ManagerOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Danh sách đơn, mới nhất trước; `status` có thì chỉ trả đơn ở trạng thái đó. */
  async list(
    status: OrderStatus | undefined, page: number, pageSize: number,
  ): Promise<{ items: ManagerOrderListItem[]; page: number; pageSize: number; total: number }> {
    const where: Prisma.OrderWhereInput = status ? { status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { ...ORDER_INCLUDE, payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);
    const items = rows.map(({ payments, ...o }) => ({ ...toOrderView(o), latestPaymentStatus: payments[0]?.status ?? null }));
    return { items, page, pageSize, total };
  }

  /** Chi tiết một đơn bất kỳ, kèm mọi lần thanh toán và lý do thất bại. */
  async detail(orderId: string): Promise<ManagerOrderDetail> {
    const don = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { ...ORDER_INCLUDE, payments: { orderBy: { createdAt: 'asc' } } },
    });
    if (!don) throw new NotFoundException('Không tìm thấy đơn hàng');
    const { payments, ...o } = don;
    return { ...toOrderView(o), payments: payments.map(toPaymentView) };
  }
}
