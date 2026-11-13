import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

/** CatalogModule: menu, chi tiết món, size, topping (backend-data-design §3; FR-01, FR-02). */
@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class CatalogModule {}
