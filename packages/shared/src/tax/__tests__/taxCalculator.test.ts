import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotals, CartItem } from '../taxCalculator';

describe('Motor de Cálculo Tributario SRI (Farmacia)', () => {
  it('debe calcular correctamente una venta exclusiva con medicamentos al 0% de IVA', () => {
    const items: CartItem[] = [
      {
        id: 'med-1',
        codigo: 'MED001',
        descripcion: 'Paracetamol 500mg',
        cantidad: 2,
        precioUnitario: 1.50,
        descuento: 0,
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
      {
        id: 'med-2',
        codigo: 'MED002',
        descripcion: 'Amoxicilina 500mg',
        cantidad: 1,
        precioUnitario: 5.00,
        descuento: 0.50,
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
    ];

    const result = calculateInvoiceTotals(items);

    expect(result.subtotal0).toBe(7.50); // (2*1.50 - 0) + (1*5.00 - 0.50) = 3.00 + 4.50 = 7.50
    expect(result.subtotal15).toBe(0.00);
    expect(result.totalSinImpuestos).toBe(7.50);
    expect(result.totalDescuento).toBe(0.50);
    expect(result.totalIva).toBe(0.00);
    expect(result.importeTotal).toBe(7.50);
  });

  it('debe calcular correctamente una venta exclusiva con insumos/higiene al 15% de IVA', () => {
    const items: CartItem[] = [
      {
        id: 'ins-1',
        codigo: 'INS001',
        descripcion: 'Alcohol antiséptico 500ml',
        cantidad: 2,
        precioUnitario: 2.00,
        descuento: 0,
        tarifaIva: 15,
        codigoPorcentajeIva: '4',
      },
    ];

    const result = calculateInvoiceTotals(items);

    expect(result.subtotal0).toBe(0.00);
    expect(result.subtotal15).toBe(4.00);
    expect(result.totalSinImpuestos).toBe(4.00);
    expect(result.totalIva).toBe(0.60); // 4.00 * 0.15 = 0.60
    expect(result.importeTotal).toBe(4.60);
  });

  it('debe calcular con precisión ventas de tarifas mixtas (0% medicinas y 15% insumos)', () => {
    const items: CartItem[] = [
      {
        id: 'med-1',
        codigo: 'MED001',
        descripcion: 'Ibuprofeno 400mg',
        cantidad: 3,
        precioUnitario: 0.25,
        descuento: 0,
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
      {
        id: 'ins-1',
        codigo: 'INS001',
        descripcion: 'Cepillo Dental',
        cantidad: 1,
        precioUnitario: 2.30,
        descuento: 0.30,
        tarifaIva: 15,
        codigoPorcentajeIva: '4',
      },
    ];

    const result = calculateInvoiceTotals(items);

    expect(result.subtotal0).toBe(0.75); // 3 * 0.25
    expect(result.subtotal15).toBe(2.00); // 1 * 2.30 - 0.30
    expect(result.totalSinImpuestos).toBe(2.75);
    expect(result.totalDescuento).toBe(0.30);
    expect(result.totalIva).toBe(0.30); // 2.00 * 0.15 = 0.30
    expect(result.importeTotal).toBe(3.05); // 2.75 + 0.30 = 3.05
  });

  it('debe redondear adecuadamente centavos según la normativa fiscal del SRI', () => {
    const items: CartItem[] = [
      {
        id: 'ins-2',
        codigo: 'INS002',
        descripcion: 'Producto con centavos complejos',
        cantidad: 1,
        precioUnitario: 1.11,
        descuento: 0,
        tarifaIva: 15,
        codigoPorcentajeIva: '4',
      },
    ];

    const result = calculateInvoiceTotals(items);

    expect(result.subtotal15).toBe(1.11);
    // 1.11 * 0.15 = 0.1665 -> redondeo a 2 decimales = 0.17
    expect(result.totalIva).toBe(0.17);
    expect(result.importeTotal).toBe(1.28);
  });

  it('debe validar el límite legal de $50 USD para Consumidor Final', () => {
    const itemsExcedidos: CartItem[] = [
      {
        id: 'med-caro',
        codigo: 'MED999',
        descripcion: 'Tratamiento Especializado',
        cantidad: 1,
        precioUnitario: 55.00,
        descuento: 0,
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
    ];

    const result = calculateInvoiceTotals(itemsExcedidos);
    expect(result.importeTotal).toBe(55.00);
    expect(result.excedeLimiteConsumidorFinal).toBe(true);

    const itemsPermitidos: CartItem[] = [
      {
        id: 'med-normal',
        codigo: 'MED100',
        descripcion: 'Medicamento Regular',
        cantidad: 1,
        precioUnitario: 45.00,
        descuento: 0,
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
    ];

    const resultPermitido = calculateInvoiceTotals(itemsPermitidos);
    expect(resultPermitido.importeTotal).toBe(45.00);
    expect(resultPermitido.excedeLimiteConsumidorFinal).toBe(false);
  });
});
