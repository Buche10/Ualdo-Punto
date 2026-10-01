import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { ProductsController } from './products.controller';
import { BatchesController } from './batches.controller';
import { InventoryService } from './inventory.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [InventoryController, ProductsController, BatchesController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
