import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/**
 * CatalogModule: menu, chi tiết món, size, topping; kiểm tra lựa chọn hợp lệ và tính giá phía máy chủ
 * (backend-data-design §3; FR-01..FR-03, FR-13).
 */
@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PricingService],
  exports: [ProductsService, PricingService],
})
export class CatalogModule {}
