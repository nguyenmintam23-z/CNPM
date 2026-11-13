import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductDetailDto, ProductListItemDto } from './dto/product.dto';

/** Số lượng còn bán được = tồn − đang giữ (Class Domain); không âm. */
export function availableQuantity(stockQuantity: number, reservedQuantity: number): number {
  return Math.max(stockQuantity - reservedQuantity, 0);
}

/** Decimal của Prisma ra JSON là chuỗi; hợp đồng API chốt trả number (VND). */
export function toVnd(value: Prisma.Decimal): number {
  return value.toNumber();
}

/**
 * So sánh tên theo thứ tự tiếng Việt (đ sau d, dấu thanh đúng chỗ).
 * Collation mặc định của PostgreSQL có thể sắp "Trà sữa" trước "Trà đào".
 */
const tenTiengViet = new Intl.Collator('vi');

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /products: chỉ món đang kinh doanh, sắp theo tên tăng dần (FR-01, api-products.md §2). */
  async findAll(): Promise<ProductListItemDto[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return products
      .map((p) => ({
        id: p.id,
        name: p.name,
        basePrice: toVnd(p.basePrice),
        imageUrl: p.imageUrl,
        availableQuantity: availableQuantity(p.stockQuantity, p.reservedQuantity),
      }))
      .sort((a, b) => tenTiengViet.compare(a.name, b.name));
  }

  /**
   * GET /products/:id: chi tiết món kèm size và topping đang bán (FR-02).
   * Không có món, hoặc món đã ngừng kinh doanh → 404 (api-products.md §4).
   */
  async findOne(id: string): Promise<ProductDetailDto> {
    const p = await this.prisma.product.findFirst({
      where: { id, isActive: true },
      include: {
        sizes: { include: { size: true }, orderBy: { size: { extraPrice: 'asc' } } },
        toppings: {
          where: { topping: { isActive: true } },
          include: { topping: true },
          orderBy: { topping: { name: 'asc' } },
        },
      },
    });
    if (!p) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      basePrice: toVnd(p.basePrice),
      imageUrl: p.imageUrl,
      availableQuantity: availableQuantity(p.stockQuantity, p.reservedQuantity),
      sizes: p.sizes.map(({ size }) => ({ id: size.id, name: size.name, extraPrice: toVnd(size.extraPrice) })),
      toppings: p.toppings.map(({ topping }) => ({ id: topping.id, name: topping.name, price: toVnd(topping.price) })),
    };
  }
}
