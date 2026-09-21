export type SriEnvironment = '1' | '2'; // 1: Pruebas, 2: Producción
export type SriEmissionType = '1'; // 1: Emisión Normal

export type SriDocType =
  | '01' // Factura
  | '04' // Nota de Crédito
  | '05' // Nota de Débito
  | '06' // Guía de Remisión
  | '07'; // Comprobante de Retención

export type SriComprobanteEstado =
  | 'GENERADO'
  | 'FIRMADO'
  | 'ENVIADO'
  | 'RECIBIDA'
  | 'AUTORIZADO'
  | 'DEVUELTA'
  | 'NO_AUTORIZADO'
  | 'EN_CONTINGENCIA'
  | 'ANULADO';

export type SriJobEstado =
  | 'PENDIENTE'
  | 'PROCESANDO'
  | 'EXITOSO'
  | 'FALLIDO';

export type SriCustomerDocType =
  | '04' // RUC
  | '05' // Cédula
  | '06' // Pasaporte
  | '07' // Consumidor Final
  | '08'; // Identificación del exterior

export type SriTaxRateCode =
  | '0' // 0%
  | '2' // 12% (histórico)
  | '3' // 14% (histórico)
  | '4' // 15% (vigente)
  | '6' // No objeto de impuesto
  | '7'; // Exento de IVA

export interface SriPaymentMethod {
  code: string; // ej. '01' (Efectivo / Sin utilización SF), '20' (Otros con utilización SF)
  name: string;
  total: number;
  plazo?: number;
  unidadTiempo?: 'dias' | 'meses' | 'anios';
}
