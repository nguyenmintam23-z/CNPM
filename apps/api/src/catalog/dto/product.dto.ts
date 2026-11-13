/**
 * Dạng dữ liệu trả về, đúng hợp đồng `apps/api/api-products.md` (Duy – Phúc chốt 13/11/2026).
 * Giá trả kiểu number, đơn vị VND; database lưu Decimal theo Class Domain.
 */
export interface ProductListItemDto {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  availableQuantity: number;
}

export interface SizeDto {
  id: string;
  name: string;
  extraPrice: number;
}

export interface ToppingDto {
  id: string;
  name: string;
  price: number;
}

export interface ProductDetailDto extends ProductListItemDto {
  description: string;
  sizes: SizeDto[];
  toppings: ToppingDto[];
}
