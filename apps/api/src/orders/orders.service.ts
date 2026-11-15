import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { CartLineInput, PricingService } from '../catalog/pricing.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';

export const MSG_REQUEST_ID_DA_DUNG = 'Mã yêu cầu đã dùng cho một đơn có nội dung khác';
export const MSG_KHONG_TIM_THAY_DON = 'Không tìm thấy đơn hàng';
export const MSG_KHONG_PHAI_CHU_DON = 'Không có quyền xem hoặc hủy đơn này';
export const MSG_KHONG_HUY_DUOC = 'Đơn không còn ở trạng thái có thể hủy';
export const MSG_DANG_THANH_TOAN = 'Đơn đang có một lần thanh toán đang xử lý, không hủy được';

/** Đơn kèm dòng món, topping, tên món và size để trả cho khách (FR-06: hiển thị món, tùy chọn, số lượng, tổng tiền). */
const ORDER_INCLUDE = {
  items: {
    orderBy: { id: 'asc' },
    include: {
      product: { select: { name: true } },
      size: { select: { name: true } },
      toppings: { orderBy: { toppingId: 'asc' }, include: { topping: { select: { name: true } } } },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderWithItems = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

export interface OrderView {
  id: string;
  orderCode: string;
  requestId: string;
  status: string;
  stockHoldStatus: string;
  totalAmount: number;
  createdAt: string;
  items: {
    productId: string;
    productName: string;
    sizeId: string | null;
    sizeName: string | null;
    sizePrice: number;
    toppings: { id: string; name: string; price: number }[];
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
}

/** Decimal → number VND, như hợp đồng api-products.md. */
const vnd = (d: Prisma.Decimal) => d.toNumber();

export function toOrderView(o: OrderWithItems): OrderView {
  return {
    id: o.id,
    orderCode: o.orderCode,
    requestId: o.requestId,
    status: o.status,
    stockHoldStatus: o.stockHoldStatus,
    totalAmount: vnd(o.totalAmount),
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      productId: i.productId,
      productName: i.product.name,
      sizeId: i.sizeId,
      sizeName: i.size?.name ?? null,
      sizePrice: vnd(i.sizePrice),
      toppings: i.toppings.map((t) => ({ id: t.toppingId, name: t.topping.name, price: vnd(t.price) })),
      quantity: i.quantity,
      unitPrice: vnd(i.unitPrice),
      lineTotal: vnd(i.lineTotal),
    })),
  };
}

/** Chữ ký nội dung giỏ để nhận ra "cùng mã yêu cầu, cùng nội dung" (UC-01 E4). Không phụ thuộc thứ tự dòng. */
export function cartSignature(lines: { productId: string; sizeId?: string | null; toppingIds?: string[]; quantity: number }[]): string {
  return lines
    .map((l) => `${l.productId}|${l.sizeId ?? ''}|${[...(l.toppingIds ?? [])].sort().join(',')}|${l.quantity}`)
    .sort()
    .join(';');
}

export function orderSignature(o: OrderWithItems): string {
  return cartSignature(o.items.map((i) => ({
    productId: i.productId, sizeId: i.sizeId, toppingIds: i.toppings.map((t) => t.toppingId), quantity: i.quantity,
  })));
}

/**
 * Mã đơn dễ đọc tại quầy: BL-yyMMdd-XXXXX (bỏ chữ dễ nhầm 0/O, 1/I). UNIQUE ở database.
 * Ngày theo giờ Việt Nam (UTC+7) vì cửa hàng ở Việt Nam, còn server Render chạy giờ UTC.
 */
const BANG_CHU = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const UTC7_MS = 7 * 60 * 60 * 1000;
export function newOrderCode(now = new Date()): string {
  const ngay = new Date(now.getTime() + UTC7_MS).toISOString().slice(2, 10).replace(/-/g, '');
  let duoi = '';
  for (let i = 0; i < 5; i++) duoi += BANG_CHU[randomInt(BANG_CHU.length)];
  return `BL-${ngay}-${duoi}`;
}

function isUniqueViolation(err: unknown, field: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  const target = (err.meta?.target ?? []) as string[] | string;
  return (Array.isArray(target) ? target.join(',') : String(target)).includes(field);
}

/**
 * OrdersModule – tạo đơn (backend-data-design §5 "Tạo đơn"; UC-01 bước 6–7; FR-06, FR-13, FR-16, FR-18, FR-22).
 * Một transaction: khóa products theo id → tra lại requestId (đã có thì trả đơn cũ) →
 * kiểm tra lựa chọn, tính giá ở server → kiểm tra tồn →
 * tạo đơn PENDING_PAYMENT / HELD với mã duy nhất → tăng reserved_quantity. Lỗi ở bất kỳ bước nào thì hoàn tác hết.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger('Orders');

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly inventory: InventoryService,
  ) {}

  /** Trả { order, created }: created = false khi gửi lại cùng mã yêu cầu và cùng nội dung (E4). */
  async checkout(userId: string, requestId: string, items: CartLineInput[]): Promise<{ order: OrderView; created: boolean }> {
    const daCo = await this.findByRequest(userId, requestId);
    if (daCo) return { order: this.sameOrConflict(daCo, items), created: false };

    for (let lan = 0; lan < 3; lan++) {
      try {
        const kq = await this.prisma.$transaction((tx) => this.createInTx(tx, userId, requestId, items));
        if (kq.daCo) {
          this.logger.log({ event: 'order_duplicate_request', orderId: kq.daCo.id, userId });
          return { order: this.sameOrConflict(kq.daCo, items), created: false };
        }
        this.logger.log({ event: 'order_created', orderId: kq.order.id, orderCode: kq.order.orderCode, userId });
        return { order: toOrderView(kq.order), created: true };
      } catch (err) {
        if (isUniqueViolation(err, 'request_id')) {
          // Hai yêu cầu cùng mã chạy song song: bản thua đọc lại đơn của bản thắng (FR-18).
          const dong = await this.findByRequest(userId, requestId);
          if (dong) {
            this.logger.log({ event: 'order_duplicate_request', orderId: dong.id, userId });
            return { order: this.sameOrConflict(dong, items), created: false };
          }
        }
        if (isUniqueViolation(err, 'order_code')) continue; // trùng mã đơn ngẫu nhiên: thử mã khác
        throw err;
      }
    }
    throw new Error('Không tạo được mã đơn duy nhất sau 3 lần thử');
  }

  private async createInTx(
    tx: Prisma.TransactionClient, userId: string, requestId: string, items: CartLineInput[],
  ): Promise<{ daCo: OrderWithItems; order?: undefined } | { daCo?: undefined; order: OrderWithItems }> {
    const locked = await this.inventory.lockProducts(tx, items.map((i) => i.productId));
    // Tra lại requestId SAU khi lấy khóa (giống thứ tự §5 cho thanh toán: khóa rồi mới tra khóa chống trùng).
    // Hai yêu cầu cùng requestId, cùng giỏ khóa cùng các dòng products: yêu cầu sau chờ yêu cầu trước commit,
    // rồi thấy đơn đã có ở đây và trả lại đơn đó, thay vì kiểm tồn và báo hết hàng (FR-18, E4; góp ý của Tâm).
    const daCo = await tx.order.findUnique({ where: { userId_requestId: { userId, requestId } }, include: ORDER_INCLUDE });
    if (daCo) return { daCo };
    const cart = await this.pricing.price(tx, items); // 400 kèm dòng cần sửa
    await this.inventory.hold(tx, cart.lines, locked); // 409 kèm món thiếu
    const order = await tx.order.create({
      data: {
        orderCode: newOrderCode(),
        userId,
        requestId,
        totalAmount: cart.totalAmount,
        items: {
          create: cart.lines.map((l) => ({
            productId: l.productId,
            sizeId: l.sizeId,
            quantity: l.quantity,
            sizePrice: l.sizePrice,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
            toppings: { create: l.toppings.map((t) => ({ toppingId: t.id, price: t.price })) },
          })),
        },
      },
      include: ORDER_INCLUDE,
    });
    return { order };
  }

  /** Lịch sử đơn của khách, mới nhất trước (FR-08). Chỉ đơn của chính người gọi; đơn đã hủy vẫn có trong lịch sử (FR-24). */
  async list(userId: string, page: number, pageSize: number): Promise<{ items: OrderView[]; page: number; pageSize: number; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: ORDER_INCLUDE,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);
    return { items: rows.map(toOrderView), page, pageSize, total };
  }

  /** Chi tiết một đơn (FR-08): 404 nếu không có; đơn của tài khoản khác bị từ chối 403, không trả chi tiết. */
  async detail(userId: string, orderId: string): Promise<OrderView> {
    const don = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!don) throw new NotFoundException(MSG_KHONG_TIM_THAY_DON);
    if (don.userId !== userId) throw new ForbiddenException(MSG_KHONG_PHAI_CHU_DON);
    return toOrderView(don);
  }

  /**
   * Hủy đơn chưa thanh toán (FR-23; NFR-08).
   * Một transaction: khóa dòng đơn (cùng khóa với thanh toán, nên hai bên xếp hàng) → kiểm tra chủ đơn →
   * đã CANCELLED thì trả lại đơn, không đổi gì (Đã hủy là trạng thái cuối, FR-24; trả 200 là [Đề xuất]) → chỉ hủy khi PENDING_PAYMENT và không có Payment PROCESSING →
   * nếu tồn còn HELD thì giải phóng; nếu đã RELEASED (sau FAILED) thì không giải phóng lần nữa.
   */
  async cancel(userId: string, orderId: string): Promise<OrderView> {
    const { order, daHuy } = await this.prisma.$transaction((tx) => this.cancelInTx(tx, userId, orderId));
    if (daHuy) this.logger.log({ event: 'order_cancelled', orderId, userId });
    return toOrderView(order);
  }

  private async cancelInTx(
    tx: Prisma.TransactionClient, userId: string, orderId: string,
  ): Promise<{ order: OrderWithItems; daHuy: boolean }> {
    const [khoa] = await tx.$queryRaw<{ user_id: string }[]>`
      SELECT user_id::text AS user_id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    if (!khoa) throw new NotFoundException(MSG_KHONG_TIM_THAY_DON);
    if (khoa.user_id !== userId) throw new ForbiddenException(MSG_KHONG_PHAI_CHU_DON);

    const don = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (don.status === 'CANCELLED') return { order: don, daHuy: false };
    if (don.status !== 'PENDING_PAYMENT') {
      throw new ConflictException({ statusCode: 409, error: 'Conflict', message: MSG_KHONG_HUY_DUOC, code: 'ORDER_NOT_CANCELLABLE', orderStatus: don.status });
    }
    const dangXuLy = await tx.payment.findFirst({ where: { orderId, status: 'PROCESSING' } });
    if (dangXuLy) {
      throw new ConflictException({ statusCode: 409, error: 'Conflict', message: MSG_DANG_THANH_TOAN, code: 'PAYMENT_IN_PROGRESS' });
    }
    if (don.stockHoldStatus === 'HELD') {
      await this.inventory.release(tx, don.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
    }
    const sau = await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', stockHoldStatus: 'RELEASED' },
      include: ORDER_INCLUDE,
    });
    return { order: sau, daHuy: true };
  }

  private findByRequest(userId: string, requestId: string): Promise<OrderWithItems | null> {
    return this.prisma.order.findUnique({ where: { userId_requestId: { userId, requestId } }, include: ORDER_INCLUDE });
  }

  /** Cùng mã yêu cầu: cùng nội dung thì trả đơn cũ; khác nội dung thì 409, không tạo đơn mới. */
  private sameOrConflict(order: OrderWithItems, items: CartLineInput[]): OrderView {
    if (orderSignature(order) !== cartSignature(items)) {
      throw new ConflictException({
        statusCode: 409, error: 'Conflict', message: MSG_REQUEST_ID_DA_DUNG, code: 'REQUEST_ID_REUSED', orderCode: order.orderCode,
      });
    }
    return toOrderView(order);
  }
}
