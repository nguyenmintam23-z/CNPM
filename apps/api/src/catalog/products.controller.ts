import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ProductDetailDto, ProductListItemDto } from './dto/product.dto';
import { ProductsService } from './products.service';

/**
 * Sprint 1: chưa yêu cầu đăng nhập (giới hạn tạm thời của MVP, Phân công Task 4 mục 3, 7).
 * Task 5 thêm guard JWT từ cookie; khi đó chưa đăng nhập trả 401 (FR-01, ADR-001).
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
