import { Controller, Get, Post, Query, Body, UseGuards, UsePipes } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CustomerSchema, Customer, createSuccessResponse } from '@pharmastock/shared';

@Controller('clientes')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('buscar')
  async buscar(@Query('identificacion') identificacion: string) {
    const cliente = await this.customersService.buscarPorIdentificacion(identificacion);
    return createSuccessResponse(cliente);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CustomerSchema))
  async crear(@Body() dto: Customer) {
    const cliente = await this.customersService.crearOActualizar(dto);
    return createSuccessResponse(cliente);
  }
}
