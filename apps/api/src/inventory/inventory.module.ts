import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';

/** InventoryModule: giữ, chốt, giải phóng tồn kho trên Product (backend-data-design §3; FR-13..FR-16). */
@Module({
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
