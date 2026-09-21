import { describe, it, expect } from 'vitest';
import { RideGeneratorService, RideFacturaData } from '../ride-generator.service';

describe('RideGeneratorService (Generador RIDE PDF Factura SRI)', () => {
  const service = new RideGeneratorService();

  const mockRideData: RideFacturaData = {
    emisor: {
      razonSocial: 'FARMACIA PHARMASTOCK S.A.',
      nombreComercial: 'PHARMASTOCK',
      ruc: '1790016919001',
      dirMatriz: 'Av. Amazonas N24-105 y Colón',
      dirEstablecimiento: 'Av. Amazonas N24-105 y Colón',
      obligadoContabilidad: 'NO',
      regimenRimpe: 'CONTRIBUYENTE RÉGIMEN RIMPE',
      ambiente: '1',
      tipoEmision: '1',
    },
    factura: {
      secuencialCompleto: '001-001-000000001',
      claveAcceso: '2109202601179001691900110010010000000011234567818',
      numeroAutorizacion: '2109202601179001691900110010010000000011234567818',
      fechaAutorizacion: '2026-09-21 17:35:00',
      fechaEmision: '21/09/2026',
    },
    cliente: {
      razonSocial: 'JUAN PEREZ',
      identificacion: '1710034065',
      tipoIdentificacion: '05',
      direccion: 'Quito, Ecuador',
      telefono: '0999999999',
      email: 'juan@correo.com',
    },
    items: [
      {
        codigo: 'MED001',
        descripcion: 'Paracetamol 500mg',
        cantidad: 2,
        precioUnitario: 1.50,
        descuento: 0,
        precioTotal: 3.00,
      },
      {
        codigo: 'INS001',
        descripcion: 'Alcohol antiséptico 500ml',
        cantidad: 1,
        precioUnitario: 2.00,
        descuento: 0,
        precioTotal: 2.00,
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
    },
    pagos: [
      {
        formaPagoNombre: 'SIN UTILIZACION DEL SISTEMA FINANCIERO',
        total: 5.30,
      },
    ],
  };

  it('debe generar un buffer PDF válido y no vacío', async () => {
    const pdfBuffer = await service.generarRidePdf(mockRideData);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // Firma mágica de archivo PDF: "%PDF-"
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });
});
