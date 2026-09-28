import { SriEnvironment } from '@pharmastock/shared';

export interface DevolucionItemDto {
  codigo: string;
  cantidad: number;
  motivo?: string;
}

export interface EmitirNotaCreditoDto {
  facturaClaveAcceso: string;
  motivo: string; // ej: "DEVOLUCION DE MERCADERIA", "DESCUENTO POST-VENTA"
  items?: DevolucionItemDto[]; // Opcional: si se omite, devolución total
  establecimiento?: string; // '001'
  puntoEmision?: string;    // '001'
  certPassword?: string;
  ambiente?: SriEnvironment;
}
