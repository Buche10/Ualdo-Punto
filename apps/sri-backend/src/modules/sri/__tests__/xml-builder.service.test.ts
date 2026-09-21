import { describe, it, expect } from 'vitest';
import { XmlBuilderService, FacturaXmlData } from '../xml-builder.service';

describe('XmlBuilderService (Generación XML Factura v2.1.0 SRI)', () => {
  const service = new XmlBuilderService();

  const mockFacturaData: FacturaXmlData = {
    ambiente: '1',
    tipoEmision: '1',
    razonSocial: 'FARMACIA PHARMASTOCK S.A.',
    nombreComercial: 'PHARMASTOCK',
    ruc: '1790016919001',
    claveAcceso: '2109202601179001691900110010010000000011234567818',
    codDoc: '01',
    estab: '001',
    ptoEmi: '001',
    secuencial: '000000001',
    dirMatriz: 'Av. Amazonas y Colón',
    dirEstablecimiento: 'Av. Amazonas y Colón',
    obligadoContabilidad: 'NO',
    regimenRimpe: 'CONTRIBUYENTE RÉGIMEN RIMPE',
    fechaEmision: '21/09/2026',
    comprador: {
      tipoIdentificacion: '07',
      razonSocial: 'CONSUMIDOR FINAL',
      identificacion: '9999999999999',
      direccion: 'QUITO',
      email: 'cliente@farmacia.com',
    },
    items: [
      {
        codigoPrincipal: 'MED001',
        descripcion: 'Paracetamol 500mg',
        cantidad: 2,
        precioUnitario: 1.50,
        descuento: 0,
        precioTotalSinImpuesto: 3.00,
        codigoImpuesto: '2',
        codigoPorcentaje: '0',
        tarifa: 0,
        valorIva: 0.00,
      },
      {
        codigoPrincipal: 'INS001',
        descripcion: 'Alcohol antiséptico 500ml',
        cantidad: 1,
        precioUnitario: 2.00,
        descuento: 0,
        precioTotalSinImpuesto: 2.00,
        codigoImpuesto: '2',
        codigoPorcentaje: '4',
        tarifa: 15,
        valorIva: 0.30,
      },
    ],
    totales: {
      subtotal0: 3.00,
      subtotal15: 2.00,
      totalSinImpuestos: 5.00,
      totalDescuento: 0.00,
      totalIva: 0.30,
      propina: 0.00,
      importeTotal: 5.30,
      impuestosDetalle: [
        {
          codigo: '2',
          codigoPorcentaje: '0',
          tarifa: 0,
          baseImponible: 3.00,
          valor: 0.00,
        },
        {
          codigo: '2',
          codigoPorcentaje: '4',
          tarifa: 15,
          baseImponible: 2.00,
          valor: 0.30,
        },
      ],
    },
    pagos: [
      {
        formaPago: '01',
        total: 5.30,
      },
    ],
  };

  it('debe construir un XML de factura v2.1.0 válido y bien formado con xmlbuilder2', () => {
    const xml = service.buildFacturaXml(mockFacturaData);

    expect(xml).toBeDefined();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<factura id="comprobante" version="2.1.0">');
    expect(xml).toContain('<claveAcceso>2109202601179001691900110010010000000011234567818</claveAcceso>');
    expect(xml).toContain('<codDoc>01</codDoc>');
    expect(xml).toContain('<estab>001</estab>');
    expect(xml).toContain('<ptoEmi>001</ptoEmi>');
    expect(xml).toContain('<secuencial>000000001</secuencial>');
  });

  it('debe incluir correctamente los bloques de infoFactura y desglose de impuestos por tarifa', () => {
    const xml = service.buildFacturaXml(mockFacturaData);

    expect(xml).toContain('<totalSinImpuestos>5.00</totalSinImpuestos>');
    expect(xml).toContain('<importeTotal>5.30</importeTotal>');
    expect(xml).toContain('<codigoPorcentaje>0</codigoPorcentaje>');
    expect(xml).toContain('<codigoPorcentaje>4</codigoPorcentaje>');
  });

  it('debe incluir los detalles de productos y su respectivo impuesto por línea', () => {
    const xml = service.buildFacturaXml(mockFacturaData);

    expect(xml).toContain('<codigoPrincipal>MED001</codigoPrincipal>');
    expect(xml).toContain('<descripcion>Paracetamol 500mg</descripcion>');
    expect(xml).toContain('<codigoPrincipal>INS001</codigoPrincipal>');
  });

  it('debe incluir información adicional como email del comprador', () => {
    const xml = service.buildFacturaXml(mockFacturaData);

    expect(xml).toContain('<infoAdicional>');
    expect(xml).toContain('<campoAdicional nombre="Email">cliente@farmacia.com</campoAdicional>');
  });
});
