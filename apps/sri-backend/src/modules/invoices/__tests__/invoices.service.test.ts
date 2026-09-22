import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoicesService, EmitirFacturaDto } from '../invoices.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('InvoicesService (Orquestación del Pipeline de Facturación SRI)', () => {
  let service: InvoicesService;

  const mockAccessKeyService = {
    generarClaveAcceso: vi.fn().mockReturnValue('2209202601179001691900110010010000000011234567818'),
  };

  const mockXmlBuilderService = {
    buildFacturaXml: vi.fn().mockReturnValue('<?xml version="1.0"?><factura id="comprobante"><infoTributaria><razonSocial>Test</razonSocial></infoTributaria></factura>'),
  };

  const mockXmlSignerService = {
    firmarFacturaXml: vi.fn().mockReturnValue('<factura id="comprobante"><ds:Signature>firmado</ds:Signature></factura>'),
  };

  const mockRideGenerator = {
    generarRidePdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock')),
  };

  const mockSriRepository = {
    obtenerSiguienteSecuencial: vi.fn().mockResolvedValue('000000042'),
    guardarComprobante: vi.fn().mockResolvedValue({ id: 'comp-uuid-1' }),
    crearSriJob: vi.fn().mockResolvedValue({ id: 'job-uuid-1' }),
    obtenerComprobantePorClave: vi.fn(),
  };

  const mockQueueWorker = {
    despacharInmediato: vi.fn().mockResolvedValue(undefined),
  };

  const baseDto: EmitirFacturaDto = {
    ambiente: '1',
    emisor: {
      ruc: '1790016919001',
      razonSocial: 'FARMACIA PHARMASTOCK S.A.',
      nombreComercial: 'PHARMASTOCK',
      dirMatriz: 'Av. Amazonas y Colón',
      dirEstablecimiento: 'Av. Amazonas y Colón',
      obligadoContabilidad: 'SI',
      regimenRimpe: 'CONTRIBUYENTE RÉGIMEN RIMPE',
    },
    establecimiento: '001',
    puntoEmision: '001',
    comprador: {
      tipoIdentificacion: '05',
      identificacion: '1710034065',
      razonSocial: 'JUAN PEREZ',
      email: 'juan@gmail.com',
    },
    items: [
      {
        id: 'item-1',
        codigo: 'MED01',
        descripcion: 'Paracetamol',
        cantidad: 2,
        precioUnitario: 1.5,
        descuento: 0,
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
    ],
    formaPagoCodigo: '01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SRI_P12_PATH = '/path/to/dummy.p12';
    process.env.SRI_P12_PASSWORD = 'password123';

    service = new InvoicesService(
      mockAccessKeyService as any,
      mockXmlBuilderService as any,
      mockXmlSignerService as any,
      mockRideGenerator as any,
      mockSriRepository as any,
      mockQueueWorker as any,
    );
  });

  it('debe orquestar el flujo completo: obtener secuencial atómico, firmar, persistir y encolar job', async () => {
    const result = await service.emitirFactura(baseDto);

    expect(mockSriRepository.obtenerSiguienteSecuencial).toHaveBeenCalledWith('01', '001', '001');
    expect(mockXmlSignerService.firmarFacturaXml).toHaveBeenCalled();
    expect(mockSriRepository.guardarComprobante).toHaveBeenCalledWith(
      expect.objectContaining({
        claveAcceso: '2209202601179001691900110010010000000011234567818',
        secuencial: '000000042',
        estado: 'FIRMADO',
      })
    );
    expect(mockSriRepository.crearSriJob).toHaveBeenCalledWith('comp-uuid-1');
    expect(mockQueueWorker.despacharInmediato).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-uuid-1',
        comprobanteId: 'comp-uuid-1',
      })
    );
    expect(result.estado).toBe('FIRMADO');
    expect(result.secuencial).toBe('001-001-000000042');
  });

  it('debe ejecutar un HARD-STOP si falta el certificado o contraseña de firma electrónica (H3)', async () => {
    delete process.env.SRI_P12_PATH;

    await expect(service.emitirFactura(baseDto)).rejects.toThrow(BadRequestException);
    expect(mockSriRepository.guardarComprobante).not.toHaveBeenCalled();
    expect(mockSriRepository.crearSriJob).not.toHaveBeenCalled();
  });

  it('debe ejecutar un HARD-STOP si la firma digital falla por clave incorrecta o certificado corrupto (H3)', async () => {
    mockXmlSignerService.firmarFacturaXml.mockImplementationOnce(() => {
      throw new Error('PKCS#12 MAC could not be verified');
    });

    await expect(service.emitirFactura(baseDto)).rejects.toThrow(BadRequestException);
    expect(mockSriRepository.guardarComprobante).not.toHaveBeenCalled();
  });

  it('debe rechazar ventas mayores a $50 a Consumidor Final sin cédula/RUC', async () => {
    const dtoExcedido: EmitirFacturaDto = {
      ...baseDto,
      comprador: {
        tipoIdentificacion: '07',
        identificacion: '9999999999999',
        razonSocial: 'CONSUMIDOR FINAL',
      },
      items: [
        {
          id: 'item-caro',
          codigo: 'CARO',
          descripcion: 'Producto costoso',
          cantidad: 1,
          precioUnitario: 60,
          descuento: 0,
          tarifaIva: 0,
          codigoPorcentajeIva: '0',
        },
      ],
    };

    await expect(service.emitirFactura(dtoExcedido)).rejects.toThrow(BadRequestException);
  });

  it('debe consultar el comprobante persistido en la BD para generar el RIDE en PDF (C1)', async () => {
    mockSriRepository.obtenerComprobantePorClave.mockResolvedValueOnce({
      id: 'comp-uuid-1',
      clave_acceso: '2209202601179001691900110010010000000011234567818',
      xml_firmado: '<factura><infoTributaria><razonSocial>Test</razonSocial><estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000001</secuencial><claveAcceso>2209202601179001691900110010010000000011234567818</claveAcceso></infoTributaria><infoFactura><fechaEmision>22/09/2026</fechaEmision><totalSinImpuestos>10.00</totalSinImpuestos><importeTotal>10.00</importeTotal></infoFactura></factura>',
      num_autorizacion: '2209202601179001691900110010010000000011234567818',
    });

    const pdfBuffer = await service.obtenerRidePdf('2209202601179001691900110010010000000011234567818');
    expect(pdfBuffer).toBeDefined();
    expect(mockRideGenerator.generarRidePdf).toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException si el comprobante no existe en la base de datos', async () => {
    mockSriRepository.obtenerComprobantePorClave.mockResolvedValueOnce(null);

    await expect(service.obtenerRidePdf('clave-inexistente')).rejects.toThrow(NotFoundException);
    await expect(service.obtenerXml('clave-inexistente')).rejects.toThrow(NotFoundException);
  });

  it('debe abortar la emisión y NUNCA llamar a despacharInmediato si guardarComprobante falla (Acceptance A)', async () => {
    mockSriRepository.guardarComprobante.mockRejectedValueOnce(new Error('DB caída o error de red'));

    await expect(service.emitirFactura(baseDto)).rejects.toThrow();
    expect(mockQueueWorker.despacharInmediato).not.toHaveBeenCalled();
    expect(mockSriRepository.crearSriJob).not.toHaveBeenCalled();
  });

  it('debe lanzar ConflictException (409) si la clave de acceso ya fue registrada previamente', async () => {
    const errorDuplicate = new Error('duplicate key value violates unique constraint');
    (errorDuplicate as any).code = '23505';
    mockSriRepository.guardarComprobante.mockRejectedValueOnce(errorDuplicate);

    await expect(service.emitirFactura(baseDto)).rejects.toThrow();
    expect(mockQueueWorker.despacharInmediato).not.toHaveBeenCalled();
  });

  it('debe abortar y NUNCA firmar ni despachar si falla la obtención del secuencial atómico', async () => {
    mockSriRepository.obtenerSiguienteSecuencial.mockRejectedValueOnce(new Error('RPC secuencial error'));

    await expect(service.emitirFactura({ ...baseDto, secuencial: undefined })).rejects.toThrow();
    expect(mockXmlSignerService.firmarFacturaXml).not.toHaveBeenCalled();
    expect(mockQueueWorker.despacharInmediato).not.toHaveBeenCalled();
  });
});

