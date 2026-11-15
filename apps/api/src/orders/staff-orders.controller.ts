import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { UpdateStatusDto } from './dto/update-status.dto';
import { OrderView } from './orders.service';
import { StaffOrdersService } from './staff-orders.service';

/**
 * API cho nhân viên quầy (FR-09, FR-10, FR-17). Chỉ `STAFF`: SRS giao "Xem đơn đã xác nhận; Cập nhật trạng thái đơn"
 * cho Nhân viên quầy, còn Quản lý chỉ "Tra cứu đơn" (FR-11, API riêng). Khách gọi → 403 (FR-17, NFR-02).
 */
@Controller('staff/orders')
@Roles(UserRole.STAFF)
export class StaffOrdersController {
  constructor(private readonly staff: StaffOrdersService) {}

  /** GET /staff/orders: hàng chờ, gồm đơn CONFIRMED, PREPARING, READY (FR-09). */
  @Get()
  queue(): Promise<OrderView[]> {
    return this.staff.queue();
  }

  /** GET /staff/orders/{id}: chi tiết đơn trong hàng chờ (FR-09). */
  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.staff.detail(id);
  }

  /** PATCH /staff/orders/{id}/status: chuyển sang bước kế tiếp (FR-10, FR-17). */
  @Patch(':id/status')
  advance(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStatusDto,
  ): Promise<OrderView> {
    return this.staff.advance(user.id, id, dto.from, dto.to);
  }
}
