import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  ReplaceInventoryDto,
  ReplaceInventoryDtoSchema,
} from './inventory.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getInventory() {
    return this.inventoryService.getInventory();
  }

  @Post('replace')
  @UsePipes(new ZodValidationPipe(ReplaceInventoryDtoSchema))
  async replaceInventory(@Body() dto: ReplaceInventoryDto) {
    const result = await this.inventoryService.replaceInventory(
      dto.products,
      dto.batches,
    );
    return { success: true, count: result };
  }
}
