import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Phân trang lịch sử đơn (FR-08). Mặc định trang 1, 20 đơn; tối đa 50 đơn mỗi trang [Đề xuất]. */
export const MAC_DINH_TRANG = 20;
export const TOI_DA_TRANG = 50;

export class ListOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page tối thiểu là 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize phải là số nguyên' })
  @Min(1, { message: 'pageSize tối thiểu là 1' })
  @Max(TOI_DA_TRANG, { message: `pageSize tối đa là ${TOI_DA_TRANG}` })
  pageSize?: number;
}
