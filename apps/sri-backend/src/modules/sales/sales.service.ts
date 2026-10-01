import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CrearVentaDto, VentaResponseDto } from './sales.dto';
import { calculateInvoiceTotals, round2, CartItem } from '@pharmastock/shared';

@Injectable()
export class SalesService {
  constructor(private readonly databaseService: DatabaseService) {}

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
        'Las ventas a Consumidor Final no pueden superar los $50.00 segun la normativa del SRI',
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

    let ventaId: string;
    try {
      const rows = await this.databaseService.query<{ venta_id: string }>(
        'SELECT public.procesar_venta_pos($1, $2, $3, $4) AS venta_id',
        [
          JSON.stringify(dto.cliente),
          JSON.stringify(itemsPayload),
          JSON.stringify(totalesPayload),
          dto.formaPagoCodigo || '01',
        ],
      );

      if (!rows || rows.length === 0 || !rows[0].venta_id) {
        throw new Error('No se genero ID para la venta procesada');
      }
      ventaId = rows[0].venta_id;
    } catch (error: any) {
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
      ventaId,
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
    try {
      const sql = `
        SELECT v.*,
          row_to_json(c.*) AS clientes,
          COALESCE((SELECT json_agg(vd.*) FROM public.venta_detalle vd WHERE vd.venta_id = v.id), '[]'::json) AS venta_detalle,
          COALESCE((SELECT json_agg(comp.*) FROM public.comprobantes comp WHERE comp.venta_id = v.id), '[]'::json) AS comprobantes
        FROM public.ventas v
        LEFT JOIN public.clientes c ON c.id = v.cliente_id
        WHERE v.id = $1
      `;
      const rows = await this.databaseService.query(sql, [ventaId]);
      if (!rows || rows.length === 0) {
        throw new NotFoundException(`Venta no encontrada: ${ventaId}`);
      }
      return rows[0];
    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Error al consultar venta: ${error.message}`);
    }
  }
}
