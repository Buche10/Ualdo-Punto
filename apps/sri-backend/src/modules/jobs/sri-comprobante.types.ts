import { SriComprobanteEstado, SriEnvironment, SriDocType } from '@pharmastock/shared';

export interface GuardarComprobanteInput {
  claveAcceso: string;
  tipoComprobante?: SriDocType;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  estado: SriComprobanteEstado;
  xmlGenerado: string;
  xmlFirmado: string;
  ambiente?: SriEnvironment;
  ventaId?: string;
}

export interface ComprobanteDbRecord {
  id: string;
  clave_acceso: string;
  establecimiento: string;
  punto_emision: string;
  secuencial: string;
  estado: SriComprobanteEstado;
  xml_generado: string;
  xml_firmado: string;
  venta_id?: string;
  num_autorizacion?: string;
  fecha_autorizacion?: string;
  mensajes_sri?: unknown[];
  stock_reintegrado?: boolean;
}

export interface GuardarNotaCreditoDetalleInput {
  comprobanteId: string;
  productoId: string;
  codigoPrincipal?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  codigoImpuesto?: string;
  codigoPorcentaje: string;
  tarifa: number;
  valorIva: number;
}

export interface NotaCreditoDetalleDbRecord {
  id: string;
  comprobante_id: string;
  producto_id: string;
  codigo_principal?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  precio_total_sin_impuesto: number;
  codigo_impuesto: string;
  codigo_porcentaje: string;
  tarifa: number;
  valor_iva: number;
  stock_reintegrado: boolean;
  created_at: string;
}
