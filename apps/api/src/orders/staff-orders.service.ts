import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_INCLUDE, OrderView, toOrderView } from './orders.service';

export const MSG_KHONG_CO_TRONG_HANG_CHO = 'Không tìm thấy đơn trong hàng chờ xử lý';
export const MSG_SAI_THU_TU = 'Chỉ được chuyển sang bước kế tiếp: Đã xác nhận → Đang chuẩn bị → Sẵn sàng nhận → Hoàn tất';
export const MSG_TRANG_THAI_DA_DOI = 'Trạng thái đơn đã thay đổi, hãy tải lại';

/** Bước kế tiếp hợp lệ của tiến độ đơn (FR-10; SRS "Trạng thái đơn": không được bỏ bước). */
export const BUOC_KE_TIEP: Partial<Record<OrderStatus, OrderStatus>> = {
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COMPLETED',
};

/**
 * Hàng chờ nhân viên quầy: đơn đã thanh toán thành công và chưa hoàn tất (FR-09).
 * Không gồm đơn chờ thanh toán, đơn thanh toán thất bại và đơn đã hủy (FR-09, FR-24).
 * Gồm cả PREPARING, READY để nhân viên cập nhật tiếp các bước sau [Đề xuất].
 */
export const TRANG_THAI_HANG_CHO: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY'];

/**
 * Xử lý đơn tại quầy (OrdersModule, backend-data-design §3, §5; FR-09, FR-10, FR-17, FR-24).
 */
@Injectable()
export class StaffOrdersService {
  private readonly logger = new Logger('StaffOrders');

  constructor(private readonly prisma: PrismaService) {}

  /** Danh sách hàng chờ, đơn cũ trước để làm theo thứ tự đến [Đề xuất]. */
  async queue(): Promise<OrderView[]> {
    const rows = await this.prisma.order.findMany({
      where: { status: { in: TRANG_THAI_HANG_CHO } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: ORDER_INCLUDE,
    });
    return rows.map(toOrderView);
  }

  /** Chi tiết một đơn trong hàng chờ: món, size, topping, số lượng (FR-09). Đơn ngoài hàng chờ → 404. */
  async detail(orderId: string): Promise<OrderView> {
    const don = await this.prisma.order.findFirst({
      where: { id: orderId, status: { in: TRANG_THAI_HANG_CHO } },
      include: ORDER_INCLUDE,
    });
    if (!don) throw new NotFoundException(MSG_KHONG_CO_TRONG_HANG_CHO);
    return toOrderView(don);
  }

  /**
   * Chuyển đơn sang bước kế tiếp (FR-10, FR-17).
   * - `to` phải đúng bước kế tiếp của `from`; bỏ bước, đi lùi hoặc bắt đầu từ đơn chưa thanh toán → 400 INVALID_TRANSITION.
   * - Ghi có điều kiện `WHERE id = … AND status = from` (backend-data-design §5). Không ghi được vì đơn đã đổi
   *   → 409 ORDER_STATUS_CHANGED kèm đơn mới nhất để giao diện tải lại (FR-17).
   */
  async advance(staffId: string, orderId: string, from: OrderStatus, to: OrderStatus): Promise<OrderView> {
    if (BUOC_KE_TIEP[from] !== to) {
      throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: MSG_SAI_THU_TU, code: 'INVALID_TRANSITION' });
    }
    const { count } = await this.prisma.order.updateMany({ where: { id: orderId, status: from }, data: { status: to } });
    const don = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!don) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (count === 0) {
      throw new ConflictException({
        statusCode: 409, error: 'Conflict', message: MSG_TRANG_THAI_DA_DOI, code: 'ORDER_STATUS_CHANGED', order: toOrderView(don),
      });
    }
    this.logger.log({ event: 'order_status_updated', orderId, from, to, staffId });
    return toOrderView(don);
  }
}
