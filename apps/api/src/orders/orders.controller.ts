import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { CheckoutDto } from './dto/checkout.dto';
import { ListOrdersQueryDto, MAC_DINH_TRANG } from './dto/list-orders.query';
import { OrdersService, OrderView } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /**
   * POST /orders/checkout (Sequence Checkout; UC-01 bước 5–8).
   * Chỉ CUSTOMER (E8: vai trò khác → 403). Chưa đăng nhập/JWT hết hạn → 401 (FR-12).
   * 201: tạo đơn mới. 200: gửi lại cùng requestId, cùng nội dung → trả đơn đã có (FR-18, E4).
   * 400: dữ liệu sai, kèm `lines` chỉ dòng cần sửa (FR-13, E1). 409: thiếu hàng, kèm `shortages` (E2);
   * hoặc requestId đã dùng cho nội dung khác.
   */
  @Post('checkout')
  @Roles(UserRole.CUSTOMER)
  async checkout(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckoutDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderView> {
    const { order, created } = await this.orders.checkout(user.id, dto.requestId, dto.items);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return order;
  }

  /** GET /orders?page&pageSize: lịch sử đơn của khách, mới nhất trước, gồm cả đơn đã hủy (FR-08, FR-24). */
  @Get()
  @Roles(UserRole.CUSTOMER)
  async list(@CurrentUser() user: AuthUser, @Query() q: ListOrdersQueryDto) {
    return this.orders.list(user.id, q.page ?? 1, q.pageSize ?? MAC_DINH_TRANG);
  }

  /** GET /orders/{id}: chi tiết một đơn của khách, kể cả đơn đã hủy (FR-08, FR-24). 403 nếu không phải đơn của mình, 404 nếu không có. */
  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  async detail(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.detail(user.id, id);
  }

  /** POST /orders/{id}/cancel: hủy đơn chưa thanh toán, giải phóng tồn (FR-23). Đã hủy trước đó cũng trả 200 [Đề xuất]. */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.CUSTOMER)
  async cancel(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string): Promise<OrderView> {
    return this.orders.cancel(user.id, id);
  }
}
