export interface CartItem {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  tarifaIva: number; // 0, 15
  codigoPorcentajeIva: string; // '0', '4'
}

export interface TaxBreakdown {
  codigo: string; // '2' para IVA en SRI
  codigoPorcentaje: string; // '0' para 0%, '4' para 15%
  tarifa: number;
  baseImponible: number;
  valor: number;
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
export function calculateInvoiceTotals(items: CartItem[]): InvoiceTotals {
  let subtotal0 = 0;
  let subtotal15 = 0;
  let totalDescuento = 0;
  let totalIva = 0;

  for (const item of items) {
    const itemSubtotalBruto = item.cantidad * item.precioUnitario;
    const itemDescuento = item.descuento || 0;
    const itemBaseImponible = Math.max(0, itemSubtotalBruto - itemDescuento);

    totalDescuento += itemDescuento;

    if (item.tarifaIva === 0) {
      subtotal0 += itemBaseImponible;
    } else if (item.tarifaIva === 15) {
      subtotal15 += itemBaseImponible;
      const ivaLinea = round2(itemBaseImponible * 0.15);
      totalIva += ivaLinea;
    }
  }

  subtotal0 = round2(subtotal0);
  subtotal15 = round2(subtotal15);
  totalDescuento = round2(totalDescuento);
  totalIva = round2(totalIva);

  const totalSinImpuestos = round2(subtotal0 + subtotal15);
  const importeTotal = round2(totalSinImpuestos + totalIva);

  const impuestosDetalle: TaxBreakdown[] = [];

  if (subtotal0 > 0) {
    impuestosDetalle.push({
      codigo: '2', // IVA
      codigoPorcentaje: '0', // 0%
      tarifa: 0,
      baseImponible: subtotal0,
      valor: 0.00,
    });
  }

  if (subtotal15 > 0) {
    impuestosDetalle.push({
      codigo: '2', // IVA
      codigoPorcentaje: '4', // 15%
      tarifa: 15,
      baseImponible: subtotal15,
      valor: totalIva,
    });
  }

  return {
    subtotal0,
    subtotal15,
    totalSinImpuestos,
    totalDescuento,
    totalIva,
    propina: 0.00,
    importeTotal,
    excedeLimiteConsumidorFinal: importeTotal > 50.00,
    impuestosDetalle,
  };
}
