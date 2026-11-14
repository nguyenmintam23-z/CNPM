import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { CheckoutDto } from './dto/checkout.dto';
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
}
