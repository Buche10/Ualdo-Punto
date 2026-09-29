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

  it('debe respetar el orden de elementos XSD oficial en infoTributaria (nombreComercial antes de ruc)', () => {
    const xml = service.buildFacturaXml(mockFacturaData);

    const posRazonSocial = xml.indexOf('<razonSocial>');
    const posNombreComercial = xml.indexOf('<nombreComercial>');
    const posRuc = xml.indexOf('<ruc>');
    const posClaveAcceso = xml.indexOf('<claveAcceso>');
    const posDirMatriz = xml.indexOf('<dirMatriz>');
    const posRimpe = xml.indexOf('<regimenRimpe>');

    expect(posRazonSocial).toBeGreaterThan(-1);
    expect(posNombreComercial).toBeGreaterThan(posRazonSocial);
    expect(posRuc).toBeGreaterThan(posNombreComercial);
    expect(posClaveAcceso).toBeGreaterThan(posRuc);
    expect(posDirMatriz).toBeGreaterThan(posClaveAcceso);
    expect(posRimpe).toBeGreaterThan(posDirMatriz);
  });

  it('A3: debe generar Nota de Crédito declarando versión 1.1.0 con orden canónico XSD y soporte RIMPE', () => {
    const xmlNc = service.buildNotaCreditoXml({
      ambiente: '1',
      tipoEmision: '1',
      razonSocial: 'FARMACIA PHARMASTOCK S.A.',
      nombreComercial: 'PHARMASTOCK',
      ruc: '1790016919001',
      claveAcceso: '2809202604179001691900110010010000000011234567812',
      codDoc: '04',
      estab: '001',
      ptoEmi: '001',
      secuencial: '000000001',
      dirMatriz: 'Av. Amazonas y Colón',
      dirEstablecimiento: 'Av. Amazonas y Colón',
      obligadoContabilidad: 'SI',
      regimenRimpe: 'CONTRIBUYENTE RÉGIMEN RIMPE',
      contribuyenteRimpe: 'CONTRIBUYENTE RÉGIMEN RIMPE',
      fechaEmision: '28/09/2026',
      comprador: {
        tipoIdentificacion: '05',
        razonSocial: 'JUAN PEREZ',
        identificacion: '1710034065',
      },
      documentoModificado: {
        codDoc: '01',
        numDoc: '001-001-000000042',
        fechaEmision: '22/09/2026',
        claveAcceso: '2209202601179001691900110010010000000011234567818',
      },
      motivo: 'DEVOLUCIÓN DE MEDICAMENTO',
      items: [
        {
          codigoInterno: 'MED-01',
          descripcion: 'Paracetamol 500mg',
          cantidad: 1,
          precioUnitario: 5.0,
          descuento: 0,
          precioTotalSinImpuesto: 5.0,
          codigoImpuesto: '2',
          codigoPorcentaje: '0',
          tarifa: 0,
          valorIva: 0,
        },
      ],
      totales: {
        subtotal0: 5.0,
        subtotal15: 0,
        totalSinImpuestos: 5.0,
        totalDescuento: 0,
        totalIva: 0,
        propina: 0,
        importeTotal: 5.0,
        impuestosDetalle: [
          {
            codigo: '2',
            codigoPorcentaje: '0',
            tarifa: 0,
            baseImponible: 5.0,
            valor: 0,
          },
        ],
      },
    });

    expect(xmlNc).toContain('<notaCredito id="comprobante" version="1.1.0">');
    expect(xmlNc).toContain('<codDoc>04</codDoc>');
    expect(xmlNc).toContain('<codDocModificado>01</codDocModificado>');
    expect(xmlNc).toContain('<numDocModificado>001-001-000000042</numDocModificado>');
    expect(xmlNc).toContain('<fechaEmisionDocSustento>22/09/2026</fechaEmisionDocSustento>');
    expect(xmlNc).toContain('<totalSinImpuestos>5.00</totalSinImpuestos>');
    expect(xmlNc).toContain('<valorModificacion>5.00</valorModificacion>');
    expect(xmlNc).toContain('<motivo>DEVOLUCIÓN DE MEDICAMENTO</motivo>');
    expect(xmlNc).toContain('<codigoInterno>MED-01</codigoInterno>');

    // Verificar orden canónico de infoTributaria
    const posDirMatriz = xmlNc.indexOf('<dirMatriz>');
    const posRimpe = xmlNc.indexOf('<regimenRimpe>');
    const posContribRimpe = xmlNc.indexOf('<contribuyenteRimpe>');
    expect(posDirMatriz).toBeGreaterThan(-1);
    expect(posRimpe).toBeGreaterThan(posDirMatriz);
    expect(posContribRimpe).toBeGreaterThan(posRimpe);
  });
});

