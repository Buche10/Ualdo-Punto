import { z } from 'zod';
import { CustomerSchema } from '@pharmastock/shared';

export const ItemVentaSchema = z.object({
  productoId: z.string().min(1, 'productoId es requerido'),
  codigo: z.string().min(1, 'codigo principal es requerido'),
  descripcion: z.string().min(1, 'descripcion es requerida'),
  cantidad: z.number().positive('la cantidad debe ser positiva'),
  precioUnitario: z.number().nonnegative('el precio unitario no puede ser negativo'),
  descuento: z.number().nonnegative('el descuento no puede ser negativo').default(0),
  tarifaIva: z.number().nonnegative('tarifaIva debe ser >= 0'),
  codigoPorcentajeIva: z.string().default('0'),
});

export const CrearVentaSchema = z.object({
  cliente: CustomerSchema,
  items: z.array(ItemVentaSchema).min(1, 'La venta debe contener al menos un ítem'),
  formaPagoCodigo: z.string().default('01'),
});

export type ItemVentaDto = z.infer<typeof ItemVentaSchema>;
export type CrearVentaDto = z.infer<typeof CrearVentaSchema>;

export interface VentaResponseDto {
  ventaId: string;
  clienteId?: string;
  fecha: string;
  totales: {
    subtotal0: number;
    subtotal15: number;
    totalSinImpuestos: number;
    totalDescuento: number;
    totalIva: number;
    importeTotal: number;
  };
  formaPagoCodigo: string;
  estado: string;
}
