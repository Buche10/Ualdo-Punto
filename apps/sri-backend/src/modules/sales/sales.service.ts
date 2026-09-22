import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { CrearVentaDto, VentaResponseDto } from './sales.dto';
import { calculateInvoiceTotals, round2, CartItem } from '@pharmastock/shared';

@Injectable()
export class SalesService {
  constructor(private readonly supabase: SupabaseService) {}

  async registrarVenta(dto: CrearVentaDto): Promise<VentaResponseDto> {
    const cartItems: CartItem[] = dto.items.map((it) => ({
      id: it.productoId,
      codigo: it.codigo,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      descuento: it.descuento || 0,
      tarifaIva: it.tarifaIva,
      codigoPorcentajeIva: it.codigoPorcentajeIva || (it.tarifaIva === 0 ? '0' : '4'),
    }));

    const totals = calculateInvoiceTotals(cartItems);

    const esConsumidorFinal =
      dto.cliente.tipoIdentificacion === '07' ||
      dto.cliente.identificacion === '9999999999999';

    if (esConsumidorFinal && totals.excedeLimiteConsumidorFinal) {
      throw new BadRequestException(
        'Las ventas a Consumidor Final no pueden superar los $50.00 según la normativa del SRI'
      );
    }

    const itemsPayload = dto.items.map((it) => {
      const bruto = it.cantidad * it.precioUnitario;
      const desc = it.descuento || 0;
      const base = round2(Math.max(0, bruto - desc));
      const tarifa = it.tarifaIva;
      const valorIva = tarifa > 0 ? round2(base * (tarifa / 100)) : 0;
      const codigoPorcentaje = it.codigoPorcentajeIva || (tarifa === 0 ? '0' : '4');

      return {
        productoId: it.productoId,
        codigo: it.codigo,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        descuento: desc,
        precioTotalSinImpuesto: base,
        codigoImpuesto: '2',
        codigoPorcentaje,
        tarifa,
        valorIva,
      };
    });

    const totalesPayload = {
      subtotal0: totals.subtotal0,
      subtotal15: totals.subtotal15,
      totalSinImpuestos: totals.totalSinImpuestos,
      totalDescuento: totals.totalDescuento,
      totalIva: totals.totalIva,
      importeTotal: totals.importeTotal,
    };

    const client = this.supabase.getClientOrThrow();
    const { data: ventaId, error } = await client.rpc('procesar_venta_pos', {
      p_cliente: dto.cliente,
      p_items: itemsPayload,
      p_totales: totalesPayload,
      p_forma_pago: dto.formaPagoCodigo || '01',
    });

    if (error) {
      const msg = error.message || 'Error desconocido al registrar venta';
      if (msg.includes('STOCK_INSUFICIENTE')) {
        throw new ConflictException(msg);
      }
      if (msg.includes('PRODUCTO_NO_ENCONTRADO')) {
        throw new NotFoundException(msg);
      }
      throw new InternalServerErrorException(msg);
    }

    return {
      ventaId: ventaId as string,
      fecha: new Date().toISOString(),
      totales: {
        subtotal0: totals.subtotal0,
        subtotal15: totals.subtotal15,
        totalSinImpuestos: totals.totalSinImpuestos,
        totalDescuento: totals.totalDescuento,
        totalIva: totals.totalIva,
        importeTotal: totals.importeTotal,
      },
      formaPagoCodigo: dto.formaPagoCodigo || '01',
      estado: 'COMPLETADA',
    };
  }

  async obtenerVentaPorId(ventaId: string) {
    const client = this.supabase.getClientOrThrow();
    const { data, error } = await client
      .from('ventas')
      .select('*, clientes(*), venta_detalle(*), comprobantes(*)')
      .eq('id', ventaId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Error al consultar venta: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundException(`Venta no encontrada: ${ventaId}`);
    }

    return data;
  }
}
