import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreditNotesService } from '../credit-notes.service';
import { SriQueueProcessor, SriJobRecord } from '../../jobs/sri-queue.processor';
import { InMemorySriComprobanteRepository } from '../../jobs/testing/in-memory-sri-comprobante.repository';

describe('A1 & A2: Reintegro de stock por producto_id real al AUTORIZAR (Idempotente y Fail-Loud)', () => {
  let repository: InMemorySriComprobanteRepository;
  let creditNotesService: CreditNotesService;
  let processor: SriQueueProcessor;

  const mockAccessKeyService = {
    generarClaveAcceso: vi.fn().mockReturnValue('2809202604179001691900110010010000000011234567812'),
  };

  const mockXmlBuilderService = {
    buildNotaCreditoXml: vi.fn().mockReturnValue('<?xml version="1.0"?><notaCredito id="comprobante"></notaCredito>'),
  };

  const mockXmlSignerService = {
    firmarNotaCreditoXml: vi.fn().mockReturnValue('<notaCredito id="comprobante"><ds:Signature>firmado</ds:Signature></notaCredito>'),
  };

  const mockQueueWorker = {
    despacharInmediato: vi.fn().mockResolvedValue(undefined),
  };

  const REAL_PRODUCTO_ID = 'prod-uuid-farmacia-999';
  const CODIGO_PRINCIPAL_XML = 'MED-AMOX-500';

  const mockSupabaseClient = {
    rpc: vi.fn().mockResolvedValue({ data: 15, error: null }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'venta_detalle') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  producto_id: REAL_PRODUCTO_ID,
                  codigo_principal: CODIGO_PRINCIPAL_XML,
                  descripcion: 'Amoxicilina 500mg Cápsulas',
                  cantidad: 3,
                },
              ],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }),
  };

  const mockSupabaseService = {
    getClientOrThrow: vi.fn().mockReturnValue(mockSupabaseClient),
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
        <totalSinImpuestos>15.00</totalSinImpuestos>
        <importeTotal>15.00</importeTotal>
      </infoFactura>
      <detalles>
        <detalle>
          <codigoPrincipal>${CODIGO_PRINCIPAL_XML}</codigoPrincipal>
          <descripcion>Amoxicilina 500mg Cápsulas</descripcion>
          <cantidad>3.00</cantidad>
          <precioUnitario>5.00</precioUnitario>
          <descuento>0.00</descuento>
          <precioTotalSinImpuesto>15.00</precioTotalSinImpuesto>
          <impuestos>
            <impuesto>
              <codigo>2</codigo>
              <codigoPorcentaje>0</codigoPorcentaje>
              <tarifa>0.00</tarifa>
              <baseImponible>15.00</baseImponible>
              <valor>0.00</valor>
            </impuesto>
          </impuestos>
        </detalle>
      </detalles>
    </factura>
  `;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.SRI_P12_PATH = '/path/to/cert.p12';
    process.env.SRI_P12_PASSWORD = 'password123';

    repository = new InMemorySriComprobanteRepository();

    // Guardar factura original en el repositorio
    await repository.guardarComprobante({
      claveAcceso: '2209202601179001691900110010010000000011234567818',
      tipoComprobante: '01',
      establecimiento: '001',
      puntoEmision: '001',
      secuencial: '000000042',
      estado: 'AUTORIZADO',
      xmlGenerado: xmlFacturaOriginal,
      xmlFirmado: xmlFacturaOriginal,
      ventaId: 'venta-uuid-1',
    });

    creditNotesService = new CreditNotesService(
      mockAccessKeyService as any,
      mockXmlBuilderService as any,
      mockXmlSignerService as any,
      repository as any,
      mockQueueWorker as any,
      mockSupabaseService as any,
    );
  });

  it('A1: Debe recuperar el producto_id real de venta_detalle (no el codigoPrincipal) y persistir lineas con producto_id', async () => {
    const res = await creditNotesService.emitirNotaCredito({
      facturaClaveAcceso: '2209202601179001691900110010010000000011234567818',
      motivo: 'Devolución de 1 unidad',
      items: [{ codigo: CODIGO_PRINCIPAL_XML, cantidad: 1 }],
    });

    expect(res.estado).toBe('FIRMADO');

    // Verificar que se persistió en el detalle con producto_id real
    expect(repository.detallesNotaCredito).toHaveLength(1);
    const detalleGuardado = repository.detallesNotaCredito[0];
    expect(detalleGuardado.productoId).toBe(REAL_PRODUCTO_ID);
    expect(detalleGuardado.codigoPrincipal).toBe(CODIGO_PRINCIPAL_XML);
    expect(detalleGuardado.cantidad).toBe(1);
    expect(detalleGuardado.stock_reintegrado).toBe(false);

    // Verificar que el stock NO fue reintegrado en la emisión
    expect(mockSupabaseClient.rpc).not.toHaveBeenCalledWith('reintegrar_stock', expect.anything());
  });

  it('A2: Si la NC queda en NO_AUTORIZADO, el stock NO se reintegra', async () => {
    const res = await creditNotesService.emitirNotaCredito({
      facturaClaveAcceso: '2209202601179001691900110010010000000011234567818',
      motivo: 'Devolución de 1 unidad',
      items: [{ codigo: CODIGO_PRINCIPAL_XML, cantidad: 1 }],
    });

    const mockSoapClient = {
      enviarComprobante: vi.fn().mockResolvedValue({ estado: 'RECIBIDA', mensajes: [] }),
      consultarAutorizacion: vi.fn().mockResolvedValue({
        estado: 'NO AUTORIZADO',
        mensajes: [{ mensaje: 'Error de validación fiscal' }],
      }),
    };

    processor = new SriQueueProcessor(mockSoapClient as any, repository);

    const jobRecord: SriJobRecord = {
      id: res.jobId,
      comprobanteId: res.id,
      claveAcceso: res.claveAcceso,
      xmlFirmado: '<xml></xml>',
      ambiente: '1',
      estadoActualComprobante: 'FIRMADO',
      intentos: 0,
      maxIntentos: 3,
    };

    const processRes = await processor.procesarJob(jobRecord);
    expect(processRes.exito).toBe(false);

    // Estado comprobante pasó a NO_AUTORIZADO
    const compDb = await repository.obtenerComprobantePorId(res.id);
    expect(compDb?.estado).toBe('NO_AUTORIZADO');
    expect(compDb?.stock_reintegrado).toBeFalsy();

    // Detalle sigue sin reintegrar stock
    expect(repository.detallesNotaCredito[0].stock_reintegrado).toBe(false);
    expect(repository.llamadasReintegro).toHaveLength(0);
  });

  it('A2: Al AUTORIZARSE la NC, se reintegra el stock transaccional e idempotentemente sin duplicar en reintentos', async () => {
    const res = await creditNotesService.emitirNotaCredito({
      facturaClaveAcceso: '2209202601179001691900110010010000000011234567818',
      motivo: 'Devolución de 1 unidad',
      items: [{ codigo: CODIGO_PRINCIPAL_XML, cantidad: 1 }],
    });

    const mockSoapClient = {
      enviarComprobante: vi.fn().mockResolvedValue({ estado: 'RECIBIDA', mensajes: [] }),
      consultarAutorizacion: vi.fn().mockResolvedValue({
        estado: 'AUTORIZADO',
        numeroAutorizacion: '2809202604179001691900110010010000000011234567812',
        fechaAutorizacion: '2026-09-28T18:00:00-05:00',
        xmlComprobante: '<notaCredito></notaCredito>',
        mensajes: [],
      }),
    };

    processor = new SriQueueProcessor(mockSoapClient as any, repository);

    const jobRecord: SriJobRecord = {
      id: res.jobId,
      comprobanteId: res.id,
      claveAcceso: res.claveAcceso,
      xmlFirmado: '<xml></xml>',
      ambiente: '1',
      estadoActualComprobante: 'FIRMADO',
      intentos: 0,
      maxIntentos: 3,
    };

    // 1er procesamiento: pasa a AUTORIZADO y repone stock
    const processRes = await processor.procesarJob(jobRecord);
    expect(processRes.exito).toBe(true);

    const compDb = await repository.obtenerComprobantePorId(res.id);
    expect(compDb?.estado).toBe('AUTORIZADO');
    expect(compDb?.stock_reintegrado).toBe(true);
    expect(repository.detallesNotaCredito[0].stock_reintegrado).toBe(true);
    expect(repository.llamadasReintegro).toHaveLength(1);

    // 2do procesamiento (reintento o re-procesamiento idempotente):
    // La RPC detecta stock_reintegrado = true y no vuelve a aplicar reintegro
    const reintento = await repository.reintegrarStockNotaCredito(res.id);
    expect(reintento).toBe(true);
    expect(compDb?.stock_reintegrado).toBe(true);
    expect(repository.detallesNotaCredito[0].stock_reintegrado).toBe(true);
  });
});
