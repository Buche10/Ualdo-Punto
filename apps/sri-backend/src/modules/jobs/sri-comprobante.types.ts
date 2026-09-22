import { SriComprobanteEstado, SriEnvironment } from '@pharmastock/shared';

export interface GuardarComprobanteInput {
  claveAcceso: string;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string;
  estado: SriComprobanteEstado;
  xmlGenerado: string;
  xmlFirmado: string;
  ambiente?: SriEnvironment;
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
  num_autorizacion?: string;
  fecha_autorizacion?: string;
  mensajes_sri?: unknown[];
}
