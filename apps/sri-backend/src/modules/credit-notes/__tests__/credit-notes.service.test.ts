import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreditNotesService } from '../credit-notes.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CreditNotesService (Fase 5 - Emision de Notas de Credito / Devoluciones)', () => {
  let service: CreditNotesService;

  const mockAccessKeyService = {
    generarClaveAcceso: vi.fn().mockReturnValue('2809202604179001691900110010010000000011234567812'),
  };

  const mockXmlBuilderService = {
    buildNotaCreditoXml: vi.fn().mockReturnValue('<?xml version="1.0"?><notaCredito id="comprobante"></notaCredito>'),
  };

  const mockXmlSignerService = {
    firmarNotaCreditoXml: vi.fn().mockReturnValue('<notaCredito id="comprobante"><ds:Signature>firmado</ds:Signature></notaCredito>'),
  };

  const mockSriRepository = {
    obtenerComprobantePorClave: vi.fn(),
    obtenerSiguienteSecuencial: vi.fn().mockResolvedValue('000000005'),
    guardarComprobante: vi.fn().mockResolvedValue({ id: 'nc-uuid-1' }),
    guardarDetallesNotaCredito: vi.fn().mockResolvedValue(true),
    crearSriJob: vi.fn().mockResolvedValue({ id: 'nc-job-1' }),
  };

  const mockQueueWorker = {
    despacharInmediato: vi.fn().mockResolvedValue(undefined),
  };

  const mockDatabaseService = {
    query: vi.fn().mockResolvedValue([
      {
        producto_id: 'real-prod-uuid-123',
        codigo_principal: 'MED-01',
        descripcion: 'Paracetamol 500mg',
        cantidad: 2,
      },
    ]),
  };

  const xmlFacturaOriginal = `
    <factura id="comprobante">
      <infoTributaria>
        <ambiente>1</ambiente>
        <tipoEmision>1</tipoEmision>
        <razonSocial>FARMACIA PHARMASTOCK S.A.</razonSocial>
        <ruc>1790016919001</ruc>
        <claveAcceso>2209202601179001691900110010010000000011234567818</claveAcceso>
        <estab>001</estab>
        <ptoEmi>001</ptoEmi>
        <secuencial>000000042</secuencial>
        <dirMatriz>Av. Amazonas y Colon</dirMatriz>
      </infoTributaria>
      <infoFactura>
        <fechaEmision>22/09/2026</fechaEmision>
        <obligadoContabilidad>SI</obligadoContabilidad>
        <tipoIdentificacionComprador>05</tipoIdentificacionComprador>
        <razonSocialComprador>JUAN PEREZ</razonSocialComprador>
        <identificacionComprador>1710034065</identificacionComprador>
        <totalSinImpuestos>10.00</totalSinImpuestos>
        <importeTotal>11.50</importeTotal>
      </infoFactura>
      <detalles>
        <detalle>
          <codigoPrincipal>MED-01</codigoPrincipal>
          <descripcion>Paracetamol 500mg</descripcion>
          <cantidad>2.00</cantidad>
          <precioUnitario>5.00</precioUnitario>
          <descuento>0.00</descuento>
          <precioTotalSinImpuesto>10.00</precioTotalSinImpuesto>
          <impuestos>
            <impuesto>
              <codigo>2</codigo>
              <codigoPorcentaje>4</codigoPorcentaje>
              <tarifa>15.00</tarifa>
              <baseImponible>10.00</baseImponible>
              <valor>1.50</valor>
            </impuesto>
          </impuestos>
        </detalle>
      </detalles>
    </factura>
  `;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SRI_P12_PATH = '/path/to/cert.p12';
    process.env.SRI_P12_PASSWORD = 'password123';

    service = new CreditNotesService(
      mockAccessKeyService as any,
      mockXmlBuilderService as any,
      mockXmlSignerService as any,
      mockSriRepository as any,
      mockQueueWorker as any,
      mockDatabaseService as any,
    );
  });

  it('debe rechazar si la clave de acceso de la factura no tiene 49 digitos', async () => {
    await expect(
      service.emitirNotaCredito({
        facturaClaveAcceso: 'clave-corta',
        motivo: 'DEVOLUCION',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe lanzar NotFoundException si la factura original no existe en la base de datos', async () => {
    mockSriRepository.obtenerComprobantePorClave.mockResolvedValueOnce(null);

    await expect(
      service.emitirNotaCredito({
        facturaClaveAcceso: '2209202601179001691900110010010000000011234567818',
        motivo: 'DEVOLUCION',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('debe lanzar BadRequestException si la factura original no esta en estado AUTORIZADO', async () => {
    mockSriRepository.obtenerComprobantePorClave.mockResolvedValueOnce({
      id: 'comp-1',
      estado: 'EN_CONTINGENCIA',
      xml_firmado: xmlFacturaOriginal,
    });

    await expect(
      service.emitirNotaCredito({
        facturaClaveAcceso: '2209202601179001691900110010010000000011234567818',
        motivo: 'DEVOLUCION',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe lanzar BadRequestException si la cantidad a devolver excede la factura original', async () => {
    mockSriRepository.obtenerComprobantePorClave.mockResolvedValueOnce({
      id: 'comp-1',
      estado: 'AUTORIZADO',
      xml_firmado: xmlFacturaOriginal,
      venta_id: 'venta-1',
    });

    await expect(
      service.emitirNotaCredito({
        facturaClaveAcceso: '2209202601179001691900110010010000000011234567818',
        motivo: 'Devolucion de 5 items',
        items: [{ codigo: 'MED-01', cantidad: 5 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe emitir correctamente una Nota de Credito total y encolarla en el worker', async () => {
    mockSriRepository.obtenerComprobantePorClave.mockResolvedValueOnce({
      id: 'comp-orig-1',
      estado: 'AUTORIZADO',
      xml_firmado: xmlFacturaOriginal,
      venta_id: 'venta-1',
    });

    const resultado = await service.emitirNotaCredito({
      facturaClaveAcceso: '2209202601179001691900110010010000000011234567818',
      motivo: 'Devolucion total de mercaderia',
    });

    expect(resultado).toBeDefined();
    expect(resultado.id).toBe('nc-uuid-1');
    expect(resultado.jobId).toBe('nc-job-1');
    expect(resultado.claveAcceso).toBe('2809202604179001691900110010010000000011234567812');
    expect(resultado.secuencial).toBe('001-001-000000005');
    expect(resultado.documentoModificado.numDoc).toBe('001-001-000000042');
    expect(resultado.documentoModificado.claveAcceso).toBe('2209202601179001691900110010010000000011234567818');
    expect(resultado.totales.importeTotal).toBe(11.50);

    expect(mockSriRepository.guardarComprobante).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoComprobante: '04',
        claveAcceso: '2809202604179001691900110010010000000011234567812',
        estado: 'FIRMADO',
        ventaId: 'venta-1',
      }),
    );

    expect(mockSriRepository.crearSriJob).toHaveBeenCalledWith('nc-uuid-1');
    expect(mockQueueWorker.despacharInmediato).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'nc-job-1',
        comprobanteId: 'nc-uuid-1',
      }),
    );
  });
});
