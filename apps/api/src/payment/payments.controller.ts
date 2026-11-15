import { Body, Controller, HttpStatus, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { PayDto } from './dto/pay.dto';
import { PaymentResult, PaymentsService } from './payments.service';

@Controller('orders')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * POST /orders/{id}/payments (Sequence Checkout; UC-01 bước 9–12).
   * 200: có kết quả cuối (SUCCEEDED hoặc FAILED, xem `payment.status`).
   * 202: chưa có kết quả (PROCESSING) → gửi lại cùng idempotencyKey để tra cứu (E6).
   * 400 method/khóa sai; 401; 403 không phải CUSTOMER hoặc không phải chủ đơn; 404 không có đơn;
   * 409 đơn không chờ thanh toán / đang có lần xử lý khác / hết hàng khi thử lại (E5).
   */
  @Post(':id/payments')
  @Roles(UserRole.CUSTOMER)
  async pay(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) orderId: string,
    @Body() dto: PayDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PaymentResult> {
    const kq = await this.payments.pay(user.id, orderId, dto.method, dto.idempotencyKey);
    res.status(kq.payment.status === 'PROCESSING' ? HttpStatus.ACCEPTED : HttpStatus.OK);
    return kq;
  }
}
