import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoicesReconciliationService } from '../invoices-reconciliation.service';
import { ConflictException } from '@nestjs/common';

describe('InvoicesReconciliationService', () => {
  let service: InvoicesReconciliationService;

  const mockAccessKeyService = {
    generarClaveAcceso: vi.fn().mockReturnValue('2209202601179001691900110010010000000011234567818'),
  };

  const mockXmlBuilderService = {
    buildFacturaXml: vi.fn().mockReturnValue('<factura>xml</factura>'),
  };

  const mockXmlSignerService = {
    firmarFacturaXml: vi.fn().mockReturnValue('<factura>firmado</factura>'),
  };

  const mockSriRepository = {
    obtenerSiguienteSecuencial: vi.fn().mockResolvedValue('000000042'),
    guardarComprobante: vi.fn().mockResolvedValue({ id: 'comp-uuid-1' }),
    crearSriJob: vi.fn().mockResolvedValue({ id: 'job-uuid-1' }),
    obtenerVentaConDetallesPorId: vi.fn(),
    consultarVentasSinFacturaAutorizada: vi.fn(),
    obtenerJobPorComprobanteId: vi.fn(),
    reiniciarJob: vi.fn(),
    obtenerEmisorConfig: vi.fn().mockResolvedValue(null),
  };

  const mockQueueWorker = {
    despacharInmediato: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SRI_P12_PATH = '/path/to/dummy.p12';
    process.env.SRI_P12_PASSWORD = 'password123';

    service = new InvoicesReconciliationService(
      mockAccessKeyService as any,
      mockXmlBuilderService as any,
      mockXmlSignerService as any,
      mockSriRepository as any,
      mockQueueWorker as any,
    );
  });

  it('debe listar ventas pendientes de autorización tributaria', async () => {
    mockSriRepository.consultarVentasSinFacturaAutorizada.mockResolvedValueOnce([
      { ventaId: 'v-1', importeTotal: 25.0, motivo: 'EN_CONTINGENCIA' },
      { ventaId: 'v-2', importeTotal: 10.0, motivo: 'SIN_COMPROBANTE' },
    ]);

    const pendientes = await service.consultarVentasSinFacturaAutorizada();
    expect(pendientes).toHaveLength(2);
    expect(pendientes[0].motivo).toBe('EN_CONTINGENCIA');
    expect(pendientes[1].motivo).toBe('SIN_COMPROBANTE');
  });

  it('debe rechazar re-emisión con ConflictException si la venta ya está AUTORIZADA', async () => {
    mockSriRepository.obtenerVentaConDetallesPorId.mockResolvedValueOnce({
      id: 'v-autorizada',
      comprobantes: [{ id: 'c-1', estado: 'AUTORIZADO', clave_acceso: '1111111111111111111111111111111111111111111111111' }],
    });

    await expect(service.reemitirFactura('v-autorizada')).rejects.toThrow(ConflictException);
  });

  it('debe re-emitir en contingencia reutilizando el comprobante SIN generar nuevo secuencial ni duplicar stock', async () => {
    mockSriRepository.obtenerVentaConDetallesPorId.mockResolvedValueOnce({
      id: 'v-contingencia',
      comprobantes: [
        {
          id: 'comp-contingencia-1',
          clave_acceso: '2209202601179001691900110010010000000011234567818',
          establecimiento: '001',
          punto_emision: '001',
          secuencial: '000000042',
          estado: 'EN_CONTINGENCIA',
          xml_firmado: '<factura>firmada</factura>',
          ambiente: '1',
        },
      ],
    });
    mockSriRepository.obtenerJobPorComprobanteId.mockResolvedValueOnce({ id: 'job-viejo-1', estado: 'FALLIDO', intentos: 5 });

    const res = await service.reemitirFactura('v-contingencia');

    expect(res.estrategia).toBe('REINTENTO_CONTINGENCIA');
    expect(res.claveAcceso).toBe('2209202601179001691900110010010000000011234567818');
    expect(res.secuencial).toBe('001-001-000000042');
    expect(mockSriRepository.obtenerSiguienteSecuencial).not.toHaveBeenCalled();
    expect(mockSriRepository.reiniciarJob).toHaveBeenCalledWith('job-viejo-1');
    expect(mockQueueWorker.despacharInmediato).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-viejo-1',
        comprobanteId: 'comp-contingencia-1',
        claveAcceso: '2209202601179001691900110010010000000011234567818',
      }),
    );
  });

  it('debe re-emitir venta sin comprobante previo generando nueva factura sin tocar stock', async () => {
    mockSriRepository.obtenerVentaConDetallesPorId.mockResolvedValueOnce({
      id: 'v-sin-comp',
      forma_pago_codigo: '01',
      comprobantes: [],
      clientes: {
        tipo_identificacion: '05',
        identificacion: '1710034065',
        razon_social: 'JUAN PEREZ',
        direccion: 'Quito',
        email: 'juan@test.com',
      },
      venta_detalle: [
        {
          producto_id: 'prod-1',
          codigo_principal: 'MED-1',
          descripcion: 'Ibuprofeno',
          cantidad: 1,
          precio_unitario: 5.0,
          descuento: 0,
          tarifa: 0,
          codigo_impuesto: '2',
          codigo_porcentaje: '0',
        },
      ],
    });

    const res = await service.reemitirFactura('v-sin-comp');

    expect(res.estrategia).toBe('NUEVA_EMISION');
    expect(mockSriRepository.obtenerSiguienteSecuencial).toHaveBeenCalledWith('01', '001', '001');
    expect(mockXmlSignerService.firmarFacturaXml).toHaveBeenCalled();
    expect(mockSriRepository.guardarComprobante).toHaveBeenCalledWith(
      expect.objectContaining({
        ventaId: 'v-sin-comp',
        estado: 'FIRMADO',
      }),
    );
    expect(mockQueueWorker.despacharInmediato).toHaveBeenCalled();
  });
});
