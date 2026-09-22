import { Controller, Post, Get, Body, Param, UseGuards, UsePipes } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CrearVentaDto, CrearVentaSchema } from './sales.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createSuccessResponse } from '@pharmastock/shared';

@Controller('ventas')
@UseGuards(ApiKeyGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CrearVentaSchema))
  async registrarVenta(@Body() dto: CrearVentaDto) {
    const venta = await this.salesService.registrarVenta(dto);
    return createSuccessResponse(venta);
  }

  @Get(':id')
  async obtenerVenta(@Param('id') id: string) {
    const venta = await this.salesService.obtenerVentaPorId(id);
    return createSuccessResponse(venta);
  }
}
