import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { validarFacturaContraXsdOficial } from '../../../../../../scripts/certificacion-validator';
import { XmlBuilderService, FacturaXmlData } from '../xml-builder.service';

describe('XSD Oficial SRI Factura V2.1.0 Validator', () => {
  const xmlBuilder = new XmlBuilderService();

  const getValidInvoiceData = (): FacturaXmlData => ({
    ambiente: '1',
    tipoEmision: '1',
    razonSocial: 'FARMACIA PHARMASTOCK EXPRESS CIA. LTDA.',
    nombreComercial: 'PHARMASTOCK EXPRESS',
    ruc: '1790016919001',
    claveAcceso: '2809202601179001691900110010010000000011234567818',
    codDoc: '01',
    estab: '001',
    ptoEmi: '001',
    secuencial: '000000001',
    dirMatriz: 'Av. Amazonas N24-15 y Colon, Quito',
    dirEstablecimiento: 'Av. Amazonas N24-15 y Colon, Quito',
    obligadoContabilidad: 'SI',
    regimenRimpe: 'CONTRIBUYENTE REGIMEN RIMPE',
    fechaEmision: '28/09/2026',
    comprador: {
      tipoIdentificacion: '05',
      razonSocial: 'JUAN PEREZ',
      identificacion: '1712345678',
      direccion: 'Quito, Ecuador',
      email: 'juan.perez@example.com',
      telefono: '0991234567',
    },
    items: [
      {
        codigoPrincipal: 'MED-001',
        descripcion: 'Paracetamol 500mg',
        cantidad: 2,
        precioUnitario: 1.5,
        descuento: 0,
        precioTotalSinImpuesto: 3,
        codigoImpuesto: '2',
        codigoPorcentaje: '0',
        tarifa: 0,
        valorIva: 0,
      },
    ],
    totales: {
      subtotal0: 3,
      subtotal15: 0,
      totalSinImpuestos: 3,
      totalDescuento: 0,
      totalIva: 0,
      propina: 0,
      importeTotal: 3,
      impuestosDetalle: [
        {
          codigo: '2',
          codigoPorcentaje: '0',
          tarifa: 0,
          baseImponible: 3,
          valor: 0,
        },
      ],
    },
    pagos: [{ formaPago: '01', total: 3 }],
  });

  it('debe validar exitosamente un XML que cumple con la estructura y restricciones oficiales', async () => {
    const data = getValidInvoiceData();
    const xml = xmlBuilder.buildFacturaXml(data);

    const result = await validarFacturaContraXsdOficial(xml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('debe fallar si el RUC del emisor no cumple con el formato de 13 dígitos numéricos', async () => {
    const data = getValidInvoiceData();
    const xml = xmlBuilder.buildFacturaXml(data);
    // Alteramos el RUC para que tenga solo 10 dígitos (inválido según pattern [0-9]{13})
    const invalidXml = xml.replace('<ruc>1790016919001</ruc>', '<ruc>1790016919</ruc>');

    const result = await validarFacturaContraXsdOficial(invalidXml);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Error de validación XSD'))).toBe(true);
  });

  it('debe fallar si obligadoContabilidad tiene un valor no permitido por la enumeración (SI/NO)', async () => {
    const data = getValidInvoiceData();
    const xml = xmlBuilder.buildFacturaXml(data);
    const invalidXml = xml.replace(
      '<obligadoContabilidad>SI</obligadoContabilidad>',
      '<obligadoContabilidad>TALVEZ</obligadoContabilidad>',
    );

    const result = await validarFacturaContraXsdOficial(invalidXml);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Error de validación XSD'))).toBe(true);
  });

  it('debe fallar si un campo excede la longitud máxima (maxLength)', async () => {
    const data = getValidInvoiceData();
    const xml = xmlBuilder.buildFacturaXml(data);
    // codigoPrincipal tiene maxLength="25"
    const superLongCode = 'A'.repeat(35);
    const invalidXml = xml.replace(
      '<codigoPrincipal>MED-001</codigoPrincipal>',
      `<codigoPrincipal>${superLongCode}</codigoPrincipal>`,
    );

    const result = await validarFacturaContraXsdOficial(invalidXml);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Error de validación XSD'))).toBe(true);
  });

  it('debe fallar si la fechaEmision no cumple con el patrón dd/mm/aaaa', async () => {
    const data = getValidInvoiceData();
    const xml = xmlBuilder.buildFacturaXml(data);
    const invalidXml = xml.replace(
      '<fechaEmision>28/09/2026</fechaEmision>',
      '<fechaEmision>2026-09-28</fechaEmision>',
    );

    const result = await validarFacturaContraXsdOficial(invalidXml);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Error de validación XSD'))).toBe(true);
  });

  it('debe fallar si la claveAcceso no tiene exactamente 49 dígitos', async () => {
    const data = getValidInvoiceData();
    const xml = xmlBuilder.buildFacturaXml(data);
    const invalidXml = xml.replace(
      '<claveAcceso>2809202601179001691900110010010000000011234567818</claveAcceso>',
      '<claveAcceso>123456</claveAcceso>',
    );

    const result = await validarFacturaContraXsdOficial(invalidXml);
    expect(result.valid).toBe(false);
  });
});
