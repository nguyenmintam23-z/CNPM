import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ProductDetailDto, ProductListItemDto } from './dto/product.dto';
import { ProductsService } from './products.service';

/**
 * Cần đăng nhập (guard JWT toàn cục trong AuthModule): chưa đăng nhập hoặc JWT hết hạn trả 401
 * và không trả danh sách đồ uống (FR-01, FR-12, ADR-001). Mọi vai trò đã đăng nhập đều xem được.
 * Sprint 1 tạm mở menu; Task 5 bỏ giới hạn này.
 */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(): Promise<ProductListItemDto[]> {
    return this.products.findAll();
  }

  /** id sai định dạng UUID → 400 (ParseUUIDPipe); không có món → 404. */
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<ProductDetailDto> {
    return this.products.findOne(id);
  }
}
