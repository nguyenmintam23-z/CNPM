import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';

/**
 * PaymentModule (backend-data-design §3, ADR-003): chứa PaymentService mô phỏng Ví/Thẻ.
 * Endpoint POST /orders/{id}/payments và việc áp dụng kết quả trong transaction thêm khi có
 * bảng orders, payments (chốt schema với Đại).
 */
@Module({
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
