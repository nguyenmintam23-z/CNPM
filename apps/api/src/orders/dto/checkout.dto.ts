import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Giới hạn chống dữ liệu bất thường, giỏ hàng web dùng cùng giới hạn [Nhóm chốt Duy và Phúc, 15/11/2026]; SRS chỉ yêu cầu số lượng ≥ 1 (FR-13 (1)). */
export const MAX_DONG = 20;
export const MAX_SO_LUONG = 20;
export const MAX_TOPPING = 5;

/** Một dòng giỏ: chỉ lựa chọn, không có giá. Gửi giá sẽ bị từ chối vì trường lạ (FR-06, NFR-04). */
export class CheckoutItemDto {
  @IsUUID('4', { message: 'productId không hợp lệ' })
  productId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'sizeId không hợp lệ' })
  sizeId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TOPPING, { message: `Mỗi món tối đa ${MAX_TOPPING} topping` })
  @IsUUID('4', { each: true, message: 'toppingId không hợp lệ' })
  toppingIds?: string[];

  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng tối thiểu là 1' })
  @Max(MAX_SO_LUONG, { message: `Số lượng tối đa ${MAX_SO_LUONG} cho mỗi dòng` })
  quantity!: number;
}

/** POST /orders/checkout (Sequence Checkout; FR-06, FR-18, FR-22). */
export class CheckoutDto {
  /** Mã yêu cầu do client tạo một lần cho mỗi lần xác nhận đặt đơn; gửi lại giữ nguyên (FR-18). */
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, { message: 'requestId gồm 8–64 ký tự chữ, số, - hoặc _' })
  requestId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Giỏ hàng trống' })
  @ArrayMaxSize(MAX_DONG, { message: `Giỏ hàng tối đa ${MAX_DONG} dòng` })
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];
}
