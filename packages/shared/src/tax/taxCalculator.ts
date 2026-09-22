export interface CartItem {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  tarifaIva: number; // 0, 15 u otra tarifa porcentual
  codigoPorcentajeIva: string; // '0' para 0%, '4' para 15%, etc.
}

export interface TaxBreakdown {
  codigo: string; // '2' para IVA en SRI
  codigoPorcentaje: string; // '0' para 0%, '4' para 15%
  tarifa: number;
  baseImponible: number;
  valor: number;
}

export interface TaxConfig {
  consumidorFinalLimit?: number;
  defaultIvaRate?: number;
}

export interface InvoiceTotals {
  subtotal0: number;
  subtotal15: number;
  totalSinImpuestos: number;
  totalDescuento: number;
  totalIva: number;
  propina: number;
  importeTotal: number;
  excedeLimiteConsumidorFinal: boolean;
  impuestosDetalle: TaxBreakdown[];
}

/**
 * Redondea un número a 2 decimales según la regla estándar de redondeo comercial
 */
export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Motor de cálculo tributario según la normativa de comprobantes electrónicos del SRI
 */
export function calculateInvoiceTotals(items: CartItem[], config?: TaxConfig): InvoiceTotals {
  const consumidorFinalLimit = config?.consumidorFinalLimit ?? 50.00;

  let subtotal0 = 0;
  let subtotal15 = 0;
  let totalDescuento = 0;
  let totalIva = 0;

  // Agrupador dinámico por código de porcentaje y tarifa
  const taxGroups = new Map<string, { tarifa: number; base: number; valor: number }>();

  for (const item of items) {
    const itemSubtotalBruto = item.cantidad * item.precioUnitario;
    const itemDescuento = item.descuento || 0;
    const itemBaseImponible = round2(Math.max(0, itemSubtotalBruto - itemDescuento));

    totalDescuento += itemDescuento;

    const tarifa = item.tarifaIva;
    const codigoPorcentaje = item.codigoPorcentajeIva || (tarifa === 0 ? '0' : '4');

    if (tarifa === 0) {
      subtotal0 += itemBaseImponible;
    } else if (tarifa === 15) {
      subtotal15 += itemBaseImponible;
    }

    const ivaLinea = tarifa > 0 ? round2(itemBaseImponible * (tarifa / 100)) : 0;
    totalIva += ivaLinea;

    const existingGroup = taxGroups.get(codigoPorcentaje) || { tarifa, base: 0, valor: 0 };
    existingGroup.base += itemBaseImponible;
    existingGroup.valor += ivaLinea;
    taxGroups.set(codigoPorcentaje, existingGroup);
  }

  subtotal0 = round2(subtotal0);
  subtotal15 = round2(subtotal15);
  totalDescuento = round2(totalDescuento);
  totalIva = round2(totalIva);

  let totalSinImpuestos = 0;
  const impuestosDetalle: TaxBreakdown[] = [];

  for (const [codPorc, group] of taxGroups.entries()) {
    const baseRedondeada = round2(group.base);
    const valorRedondeado = round2(group.valor);
    totalSinImpuestos += baseRedondeada;

    impuestosDetalle.push({
      codigo: '2', // IVA
      codigoPorcentaje: codPorc,
      tarifa: group.tarifa,
      baseImponible: baseRedondeada,
      valor: valorRedondeado,
    });
  }

  totalSinImpuestos = round2(totalSinImpuestos);
  const importeTotal = round2(totalSinImpuestos + totalIva);

  return {
    subtotal0,
    subtotal15,
    totalSinImpuestos,
    totalDescuento,
    totalIva,
    propina: 0.00,
    importeTotal,
    excedeLimiteConsumidorFinal: importeTotal > consumidorFinalLimit,
    impuestosDetalle,
  };
}
