import { Controller, Post, Get, Body, Param, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { InvoicesService, EmitirFacturaDto } from './invoices.service';
import { calculateInvoiceTotals, createSuccessResponse, CartItem } from '@pharmastock/shared';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('emitir')
  public async emitirFactura(@Body() dto: EmitirFacturaDto) {
    const factura = await this.invoicesService.emitirFactura(dto);
    return createSuccessResponse(factura);
  }

  @Post('calcular')
  public calcularTotales(@Body() body: { items: CartItem[] }) {
    const totales = calculateInvoiceTotals(body.items || []);
    return createSuccessResponse(totales);
  }

  @Get(':claveAcceso/ride')
  public async descargarRide(
    @Param('claveAcceso') claveAcceso: string,
    @Res() res: Response
  ) {
    const pdfBuffer = await this.invoicesService.obtenerRidePdf(claveAcceso);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="RIDE_${claveAcceso}.pdf"`);
    res.status(HttpStatus.OK).send(pdfBuffer);
  }

  @Get(':claveAcceso/xml')
  public descargarXml(
    @Param('claveAcceso') claveAcceso: string,
    @Res() res: Response
  ) {
    const xmlContent = this.invoicesService.obtenerXml(claveAcceso);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${claveAcceso}.xml"`);
    res.status(HttpStatus.OK).send(xmlContent);
  }
}
