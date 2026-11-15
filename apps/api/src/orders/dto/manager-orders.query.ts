import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { ListOrdersQueryDto } from './list-orders.query';

/** Tra cứu đơn cho quản lý (FR-11): lọc theo trạng thái đơn, phân trang như lịch sử đơn của khách. */
export class ManagerOrdersQueryDto extends ListOrdersQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus, { message: 'status không phải trạng thái đơn hợp lệ' })
  status?: OrderStatus;
}
