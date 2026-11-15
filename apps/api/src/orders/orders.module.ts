import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { StaffOrdersController } from './staff-orders.controller';
import { StaffOrdersService } from './staff-orders.service';
import { ManagerOrdersController } from './manager-orders.controller';
import { ManagerOrdersService } from './manager-orders.service';

/**
 * OrdersModule (backend-data-design §3): tạo đơn theo requestId; lịch sử, chi tiết, hủy đơn của khách;
 * hàng chờ và cập nhật tiến độ cho nhân viên quầy; tra cứu và lọc đơn cho quản lý.
 * Phụ thuộc CatalogModule (tính giá), InventoryModule (giữ tồn), PrismaModule (toàn cục).
 */
@Module({
  imports: [CatalogModule, InventoryModule],
  controllers: [OrdersController, StaffOrdersController, ManagerOrdersController],
  providers: [OrdersService, StaffOrdersService, ManagerOrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
