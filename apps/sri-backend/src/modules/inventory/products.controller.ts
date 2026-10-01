import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  ProductDto,
  ProductDtoSchema,
  BatchProductsDto,
  BatchProductsDtoSchema,
} from './inventory.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(ProductDtoSchema))
  async createProduct(@Body() product: ProductDto) {
    const data = await this.inventoryService.createProduct(product);
    return { success: true, product: data };
  }

  @Post('batch')
  @UsePipes(new ZodValidationPipe(BatchProductsDtoSchema))
  async createProductsBatch(@Body() dto: BatchProductsDto) {
    await this.inventoryService.upsertProductsBatch(dto.products);
    return { success: true, count: dto.products.length };
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(ProductDtoSchema))
  async updateProduct(@Param('id') id: string, @Body() product: ProductDto) {
    const data = await this.inventoryService.updateProduct(id, product);
    return { success: true, product: data };
  }

  @Delete(':id')
  async deleteProduct(@Param('id') id: string) {
    await this.inventoryService.deleteProduct(id);
    return { success: true, id };
  }
}
