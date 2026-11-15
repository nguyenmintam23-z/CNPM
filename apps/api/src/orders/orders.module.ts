import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

/**
 * OrdersModule (backend-data-design §3): tạo đơn theo requestId; lịch sử, chi tiết, hủy đơn của khách.
 * Hàng chờ nhân viên và tra cứu quản lý thêm ở các PR sau.
 * Phụ thuộc CatalogModule (tính giá), InventoryModule (giữ tồn), PrismaModule (toàn cục).
 */
@Module({
  imports: [CatalogModule, InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
