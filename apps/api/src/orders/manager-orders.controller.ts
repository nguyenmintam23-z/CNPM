import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { MAC_DINH_TRANG } from './dto/list-orders.query';
import { ManagerOrdersQueryDto } from './dto/manager-orders.query';
import { ManagerOrderDetail, ManagerOrdersService } from './manager-orders.service';

/**
 * API tra cứu đơn cho quản lý (FR-11, Should). Chỉ `MANAGER`: SRS giao "Tra cứu đơn" cho Quản lý.
 * Chỉ đọc; quản lý không cập nhật tiến độ (đó là việc của Nhân viên quầy, FR-10). Vai trò khác → 403 (NFR-02).
 */
@Controller('manager/orders')
@Roles(UserRole.MANAGER)
export class ManagerOrdersController {
  constructor(private readonly manager: ManagerOrdersService) {}

  /** GET /manager/orders?status&page&pageSize: mọi đơn của cửa hàng, mới nhất trước, lọc theo trạng thái. */
  @Get()
  list(@Query() q: ManagerOrdersQueryDto) {
    return this.manager.list(q.status, q.page ?? 1, q.pageSize ?? MAC_DINH_TRANG);
  }

  /** GET /manager/orders/{id}: chi tiết đơn kèm các lần thanh toán, lý do thất bại nếu có. */
  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string): Promise<ManagerOrderDetail> {
    return this.manager.detail(id);
  }
}
