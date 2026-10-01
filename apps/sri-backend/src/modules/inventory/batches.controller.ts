import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { BatchDto, BatchDtoSchema } from './inventory.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('batches')
@UseGuards(JwtAuthGuard)
export class BatchesController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(BatchDtoSchema))
  async createBatch(@Body() batch: BatchDto) {
    const data = await this.inventoryService.createBatch(batch);
    return { success: true, batch: data };
  }

  @Delete(':id')
  async deleteBatch(@Param('id') id: string) {
    await this.inventoryService.deleteBatch(id);
    return { success: true, id };
  }
}
