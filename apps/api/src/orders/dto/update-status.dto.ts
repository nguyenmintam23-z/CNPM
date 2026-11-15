import { OrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

/**
 * Cập nhật tiến độ đơn (FR-10). Gửi cả trạng thái đang thấy trên màn hình (`from`) và trạng thái muốn chuyển tới (`to`).
 * Backend chỉ ghi khi đơn còn đúng `from` (backend-data-design §5 "Cập nhật tiến độ"), nên hai nhân viên cùng bấm
 * từ một trạng thái cũ thì chỉ một yêu cầu được ghi (FR-17).
 */
export class UpdateStatusDto {
  @IsEnum(OrderStatus, { message: 'from không phải trạng thái đơn hợp lệ' })
  from!: OrderStatus;

  @IsEnum(OrderStatus, { message: 'to không phải trạng thái đơn hợp lệ' })
  to!: OrderStatus;
}
