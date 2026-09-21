import { describe, it, expect, beforeAll } from 'vitest';
import { XmlSignerService } from '../xml-signer.service';
import { XmlBuilderService } from '../xml-builder.service';
import forge from 'node-forge';

describe('XmlSignerService (Firma XAdES-BES SRI)', () => {
  const signerService = new XmlSignerService();
  const builderService = new XmlBuilderService();
  let p12Buffer: Buffer;
  const password = 'TestPassword123!';

  beforeAll(() => {
    // Generar un certificado PKCS#12 de prueba en memoria usando node-forge
    const keys = forge.pki.rsa.generateKeyPair(1024);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [
      { name: 'commonName', value: 'FARMACIA TEST S.A.' },
      { name: 'countryName', value: 'EC' },
      { shortName: 'ST', value: 'Pichincha' },
      { name: 'localityName', value: 'Quito' },
      { name: 'organizationName', value: 'Farmacia Test' },
      { shortName: 'OU', value: 'Sistemas' },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      [cert],
      password,
      { generateLocalKeyId: true, friendlyName: 'TestCert' }
    );
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    p12Buffer = Buffer.from(p12Der, 'binary');
  });

  it('debe firmar exitosamente una factura XML con estructura XAdES-BES válida', () => {
    const xmlOriginal = builderService.buildFacturaXml({
      ambiente: '1',
      tipoEmision: '1',
      razonSocial: 'FARMACIA TEST S.A.',
      ruc: '1790016919001',
      claveAcceso: '2109202601179001691900110010010000000011234567818',
      codDoc: '01',
      estab: '001',
      ptoEmi: '001',
      secuencial: '000000001',
      dirMatriz: 'Quito',
      dirEstablecimiento: 'Quito',
      obligadoContabilidad: 'NO',
      fechaEmision: '21/09/2026',
      comprador: {
        tipoIdentificacion: '07',
        razonSocial: 'CONSUMIDOR FINAL',
        identificacion: '9999999999999',
      },
      items: [
        {
          codigoPrincipal: 'MED001',
          descripcion: 'Paracetamol',
          cantidad: 1,
          precioUnitario: 1.00,
          descuento: 0,
          precioTotalSinImpuesto: 1.00,
          codigoImpuesto: '2',
          codigoPorcentaje: '0',
          tarifa: 0,
          valorIva: 0.00,
        },
      ],
      totales: {
        subtotal0: 1.00,
        subtotal15: 0.00,
        totalSinImpuestos: 1.00,
        totalDescuento: 0.00,
        totalIva: 0.00,
        propina: 0.00,
        importeTotal: 1.00,
        impuestosDetalle: [
          {
            codigo: '2',
            codigoPorcentaje: '0',
            tarifa: 0,
            baseImponible: 1.00,
            valor: 0.00,
          },
        ],
      },
      pagos: [{ formaPago: '01', total: 1.00 }],
    });

    const xmlFirmado = signerService.firmarFacturaXml(xmlOriginal, {
      p12Buffer,
      p12Password: password,
    });

    expect(xmlFirmado).toBeDefined();
    expect(signerService.tieneFirmaDigital(xmlFirmado)).toBe(true);
    expect(xmlFirmado).toContain('<ds:Signature');
    expect(xmlFirmado).toContain('<ds:SignedInfo');
    expect(xmlFirmado).toContain('<ds:SignatureValue');
    expect(xmlFirmado).toContain('<xades:QualifyingProperties');
    expect(xmlFirmado).toContain('<xades:SignedProperties');
  });

  it('debe lanzar error cuando la contraseña del certificado es incorrecta', () => {
    const xmlOriginal = '<factura id="comprobante" version="2.1.0"></factura>';
    expect(() => {
      signerService.firmarFacturaXml(xmlOriginal, {
        p12Buffer,
        p12Password: 'ClaveEquivocada',
      });
    }).toThrow();
  });
});
