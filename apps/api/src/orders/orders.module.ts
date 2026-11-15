import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { StaffOrdersController } from './staff-orders.controller';
import { StaffOrdersService } from './staff-orders.service';

/**
 * OrdersModule (backend-data-design §3): tạo đơn theo requestId; lịch sử, chi tiết, hủy đơn của khách;
 * hàng chờ và cập nhật tiến độ cho nhân viên quầy. Tra cứu cho quản lý thêm ở PR sau.
 * Phụ thuộc CatalogModule (tính giá), InventoryModule (giữ tồn), PrismaModule (toàn cục).
 */
@Module({
  imports: [CatalogModule, InventoryModule],
  controllers: [OrdersController, StaffOrdersController],
  providers: [OrdersService, StaffOrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
