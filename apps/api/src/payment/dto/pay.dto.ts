import { IsIn, IsString, Matches } from 'class-validator';
import { PAYMENT_METHODS, PaymentMethod } from '../payment.service';

/** POST /orders/{id}/payments (Sequence Checkout: JWT + method + idempotencyKey; FR-07, FR-15). */
export class PayDto {
  /** Ví mô phỏng hoặc Thẻ mô phỏng; không nhận thông tin thẻ thật (backend-operations §2). */
  @IsIn(PAYMENT_METHODS, { message: 'Phương thức thanh toán phải là WALLET hoặc CARD' })
  method!: PaymentMethod;

  /** Khóa chống xử lý trùng: gửi lại giữ nguyên; thử lại sau thất bại dùng khóa mới (FR-14, FR-15). */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, { message: 'idempotencyKey gồm 8–64 ký tự chữ, số, - hoặc _' })
  idempotencyKey!: string;
}
