import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentService } from './payment.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

/**
 * PaymentModule (backend-data-design §3, ADR-003): mỗi lần thử thanh toán là một Payment; chống xử lý trùng
 * bằng idempotencyKey; áp dụng kết quả cuối đúng một lần khi Payment còn PROCESSING.
 * PaymentService là bộ mô phỏng Ví/Thẻ chạy cùng tiến trình API.
 */
@Module({
  imports: [InventoryModule],
  controllers: [PaymentsController],
  providers: [PaymentService, PaymentsService],
  exports: [PaymentService],
})
export class PaymentModule {}
