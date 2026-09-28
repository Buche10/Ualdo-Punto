import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreditNotesService } from '../credit-notes.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CreditNotesService (Fase 5 - Emisión de Notas de Crédito / Devoluciones)', () => {
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
    crearSriJob: vi.fn().mockResolvedValue({ id: 'nc-job-1' }),
  };

  const mockQueueWorker = {
    despacharInmediato: vi.fn().mockResolvedValue(undefined),
  };

  const mockSupabaseService = {
    getClientOrThrow: vi.fn().mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: 10, error: null }),
    }),
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
      mockSupabaseService as any,
    );
  });

  it('debe rechazar si la clave de acceso de la factura no tiene 49 dígitos', async () => {
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

  it('debe lanzar BadRequestException si la factura original no está en estado AUTORIZADO', async () => {
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

  it('debe rechazar si la cantidad a devolver supera la cantidad facturada', async () => {
    mockSriRepository.obtenerComprobantePorClave.mockResolvedValueOnce({
      id: 'comp-1',
      estado: 'AUTORIZADO',
      xml_firmado: xmlFacturaOriginal,
    });

    await expect(
      service.emitirNotaCredito({
        facturaClaveAcceso: '2209202601179001691900110010010000000011234567818',
        motivo: 'DEVOLUCION',
        items: [{ codigo: 'MED-01', cantidad: 5 }], // Facturado era 2
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe emitir exitosamente la Nota de Crédito ligada a la factura original y encolar el job', async () => {
    mockSriRepository.obtenerComprobantePorClave.mockResolvedValueOnce({
      id: 'comp-1',
      estado: 'AUTORIZADO',
      xml_firmado: xmlFacturaOriginal,
      venta_id: 'venta-uuid-1',
    });

    const resultado = await service.emitirNotaCredito({
      facturaClaveAcceso: '2209202601179001691900110010010000000011234567818',
      motivo: 'DEVOLUCIÓN PARCIAL MEDICAMENTO',
      items: [{ codigo: 'MED-01', cantidad: 1 }],
    });

    expect(resultado.documentoModificado).toEqual({
      tipo: '01',
      numDoc: '001-001-000000042',
      claveAcceso: '2209202601179001691900110010010000000011234567818',
    });

    // Secuencial de nota de crédito (tipo '04')
    expect(mockSriRepository.obtenerSiguienteSecuencial).toHaveBeenCalledWith('04', '001', '001');

    // Clave de acceso generada con tipo '04'
    expect(mockAccessKeyService.generarClaveAcceso).toHaveBeenCalledWith(
      expect.objectContaining({ tipoComprobante: '04' }),
    );

    // Firma con ec-sri-invoice-signer
    expect(mockXmlSignerService.firmarNotaCreditoXml).toHaveBeenCalled();

    // Guardado con tipo_comprobante '04'
    expect(mockSriRepository.guardarComprobante).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoComprobante: '04',
        estado: 'FIRMADO',
        ventaId: 'venta-uuid-1',
      }),
    );

    // Encolado y despacho en worker asíncrono
    expect(mockSriRepository.crearSriJob).toHaveBeenCalledWith('nc-uuid-1');
    expect(mockQueueWorker.despacharInmediato).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'nc-job-1',
        comprobanteId: 'nc-uuid-1',
      }),
    );
  });
});
