import { describe, it, expect, vi } from 'vitest';
import { SriQueueProcessor, SriJobRecord } from '../sri-queue.processor';

describe('SriQueueProcessor (Cola de trabajos SRI y Contingencia)', () => {
  it('debe procesar un comprobante hasta estado AUTORIZADO cuando el SRI responde favorablemente', async () => {
    const mockSoapClient = {
      enviarComprobante: vi.fn().mockResolvedValue({
        estado: 'RECIBIDA',
        mensajes: [],
      }),
      consultarAutorizacion: vi.fn().mockResolvedValue({
        estado: 'AUTORIZADO',
        numeroAutorizacion: '2109202601179001691900110010010000000011234567818',
        fechaAutorizacion: '2026-09-21T17:40:00-05:00',
        mensajes: [],
      }),
    };

    const mockRepo = {
      actualizarComprobante: vi.fn().mockResolvedValue(true),
      actualizarJob: vi.fn().mockResolvedValue(true),
    };

    const processor = new SriQueueProcessor(mockSoapClient as any, mockRepo as any);

    const job: SriJobRecord = {
      id: 'job-1',
      comprobanteId: 'comp-1',
      claveAcceso: '2109202601179001691900110010010000000011234567818',
      xmlFirmado: '<factura>xml-firmado</factura>',
      ambiente: '1',
      estadoActualComprobante: 'FIRMADO',
      intentos: 0,
      maxIntentos: 3,
    };

    const resultado = await processor.procesarJob(job);

    expect(resultado.exito).toBe(true);
    expect(mockSoapClient.enviarComprobante).toHaveBeenCalled();
    expect(mockSoapClient.consultarAutorizacion).toHaveBeenCalled();
    expect(mockRepo.actualizarComprobante).toHaveBeenCalledWith(
      'comp-1',
      expect.objectContaining({
        estado: 'AUTORIZADO',
        numAutorizacion: '2109202601179001691900110010010000000011234567818',
      })
    );
    expect(mockRepo.actualizarJob).toHaveBeenCalledWith('job-1', 'EXITOSO', expect.anything());
  });

  it('debe poner el comprobante en EN_CONTINGENCIA si el SRI falla repetidamente hasta agotar reintentos', async () => {
    const mockSoapClient = {
      enviarComprobante: vi.fn().mockResolvedValue({
        estado: 'ERROR',
        mensajes: [{ identificador: 'TIMEOUT', mensaje: 'SRI Offline', tipo: 'ERROR' }],
      }),
      consultarAutorizacion: vi.fn(),
    };

    const mockRepo = {
      actualizarComprobante: vi.fn().mockResolvedValue(true),
      actualizarJob: vi.fn().mockResolvedValue(true),
    };

    const processor = new SriQueueProcessor(mockSoapClient as any, mockRepo as any);

    const job: SriJobRecord = {
      id: 'job-2',
      comprobanteId: 'comp-2',
      claveAcceso: '2109202601179001691900110010010000000011234567818',
      xmlFirmado: '<factura>xml-firmado</factura>',
      ambiente: '1',
      estadoActualComprobante: 'FIRMADO',
      intentos: 2, // Era su 3er intento (max = 3)
      maxIntentos: 3,
    };

    const resultado = await processor.procesarJob(job);

    expect(resultado.exito).toBe(false);
    expect(mockRepo.actualizarComprobante).toHaveBeenCalledWith(
      'comp-2',
      expect.objectContaining({
        estado: 'EN_CONTINGENCIA',
      })
    );
    expect(mockRepo.actualizarJob).toHaveBeenCalledWith('job-2', 'FALLIDO', expect.anything());
  });

  it('debe enviar automáticamente el XML y RIDE por email al cliente al autorizar el comprobante y registrar el envío', async () => {
    const xmlConEmail = `
      <factura id="comprobante">
        <infoTributaria>
          <razonSocial>FARMACIA PHARMASTOCK S.A.</razonSocial>
          <estab>001</estab>
          <ptoEmi>001</ptoEmi>
          <secuencial>000000042</secuencial>
        </infoTributaria>
        <infoFactura>
          <fechaEmision>28/09/2026</fechaEmision>
          <totalSinImpuestos>10.00</totalSinImpuestos>
          <importeTotal>11.50</importeTotal>
        </infoFactura>
        <detalles><detalle><codigoPrincipal>P1</codigoPrincipal><cantidad>1</cantidad><precioUnitario>10</precioUnitario><precioTotalSinImpuesto>10</precioTotalSinImpuesto></detalle></detalles>
        <infoAdicional>
          <campoAdicional nombre="Email">cliente.destinatario@farmacia.com</campoAdicional>
        </infoAdicional>
      </factura>
    `;

    const mockSoapClient = {
      enviarComprobante: vi.fn().mockResolvedValue({ estado: 'RECIBIDA', mensajes: [] }),
      consultarAutorizacion: vi.fn().mockResolvedValue({
        estado: 'AUTORIZADO',
        numeroAutorizacion: '2809202601179001691900110010010000000011234567818',
        fechaAutorizacion: '2026-09-28T18:00:00-05:00',
        xmlComprobante: xmlConEmail,
        mensajes: [],
      }),
    };

    const mockRepo = {
      actualizarComprobante: vi.fn().mockResolvedValue(true),
      actualizarJob: vi.fn().mockResolvedValue(true),
      registrarLogEnvio: vi.fn().mockResolvedValue(true),
    };

    const mockMailer = {
      enviarFacturaEmail: vi.fn().mockResolvedValue({ enviado: true }),
    };

    const mockRideGen = {
      generarRidePdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
    };

    const processor = new SriQueueProcessor(
      mockSoapClient as any,
      mockRepo as any,
      mockMailer as any,
      mockRideGen as any,
    );

    const job: SriJobRecord = {
      id: 'job-mail-1',
      comprobanteId: 'comp-mail-1',
      claveAcceso: '2809202601179001691900110010010000000011234567818',
      xmlFirmado: xmlConEmail,
      ambiente: '1',
      estadoActualComprobante: 'FIRMADO',
      intentos: 0,
      maxIntentos: 3,
    };

    const res = await processor.procesarJob(job);
    expect(res.exito).toBe(true);
    expect(mockRideGen.generarRidePdf).toHaveBeenCalled();
    expect(mockMailer.enviarFacturaEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        destinatario: 'cliente.destinatario@farmacia.com',
        numeroFactura: '001-001-000000042',
      }),
    );
    expect(mockRepo.registrarLogEnvio).toHaveBeenCalledWith(
      'comp-mail-1',
      expect.objectContaining({
        tipo: 'ENVIO_AUTOMATICO_EMAIL',
        destinatario: 'cliente.destinatario@farmacia.com',
        enviado: true,
      }),
    );
  });

  it('debe invocar reintegrarStockNotaCredito cuando un comprobante tipo 04 (Nota de Crédito) pasa a AUTORIZADO', async () => {
    const mockSoapClient = {
      enviarComprobante: vi.fn().mockResolvedValue({ estado: 'RECIBIDA', mensajes: [] }),
      consultarAutorizacion: vi.fn().mockResolvedValue({
        estado: 'AUTORIZADO',
        numeroAutorizacion: '2809202604179001691900110010010000000011234567812',
        fechaAutorizacion: '2026-09-28T18:30:00-05:00',
        xmlComprobante: '<notaCredito></notaCredito>',
        mensajes: [],
      }),
    };

    const mockRepo = {
      actualizarComprobante: vi.fn().mockResolvedValue(true),
      actualizarJob: vi.fn().mockResolvedValue(true),
      reintegrarStockNotaCredito: vi.fn().mockResolvedValue(true),
    };

    const processor = new SriQueueProcessor(mockSoapClient as any, mockRepo as any);

    const job: SriJobRecord = {
      id: 'job-nc-1',
      comprobanteId: 'comp-nc-1',
      // Tipo '04' en posiciones 8-9: 28092026 04 1790016919001...
      claveAcceso: '2809202604179001691900110010010000000011234567812',
      xmlFirmado: '<notaCredito>firmado</notaCredito>',
      ambiente: '1',
      estadoActualComprobante: 'FIRMADO',
      intentos: 0,
      maxIntentos: 3,
    };

    const res = await processor.procesarJob(job);
    expect(res.exito).toBe(true);
    expect(mockRepo.reintegrarStockNotaCredito).toHaveBeenCalledWith('comp-nc-1');
  });

  it('NO debe invocar el reintegro de stock si la Nota de Crédito queda en NO_AUTORIZADO', async () => {
    const mockSoapClient = {
      enviarComprobante: vi.fn().mockResolvedValue({ estado: 'RECIBIDA', mensajes: [] }),
      consultarAutorizacion: vi.fn().mockResolvedValue({
        estado: 'NO AUTORIZADO',
        mensajes: [{ mensaje: 'Error de firma' }],
      }),
    };

    const mockRepo = {
      actualizarComprobante: vi.fn().mockResolvedValue(true),
      actualizarJob: vi.fn().mockResolvedValue(true),
      reintegrarStockNotaCredito: vi.fn().mockResolvedValue(true),
    };

    const processor = new SriQueueProcessor(mockSoapClient as any, mockRepo as any);

    const job: SriJobRecord = {
      id: 'job-nc-2',
      comprobanteId: 'comp-nc-2',
      claveAcceso: '2809202604179001691900110010010000000011234567812',
      xmlFirmado: '<notaCredito>firmado</notaCredito>',
      ambiente: '1',
      estadoActualComprobante: 'FIRMADO',
      intentos: 0,
      maxIntentos: 3,
    };

    const res = await processor.procesarJob(job);
    expect(res.exito).toBe(false);
    expect(mockRepo.actualizarComprobante).toHaveBeenCalledWith(
      'comp-nc-2',
      expect.objectContaining({ estado: 'NO_AUTORIZADO' }),
    );
    expect(mockRepo.reintegrarStockNotaCredito).not.toHaveBeenCalled();
  });

  it('NO debe invocar reintegrarStockNotaCredito si el comprobante autorizado es una Factura (tipo 01)', async () => {
    const mockSoapClient = {
      enviarComprobante: vi.fn().mockResolvedValue({ estado: 'RECIBIDA', mensajes: [] }),
      consultarAutorizacion: vi.fn().mockResolvedValue({
        estado: 'AUTORIZADO',
        numeroAutorizacion: '2809202601179001691900110010010000000011234567818',
        mensajes: [],
      }),
    };

    const mockRepo = {
      actualizarComprobante: vi.fn().mockResolvedValue(true),
      actualizarJob: vi.fn().mockResolvedValue(true),
      reintegrarStockNotaCredito: vi.fn().mockResolvedValue(true),
    };

    const processor = new SriQueueProcessor(mockSoapClient as any, mockRepo as any);

    const job: SriJobRecord = {
      id: 'job-fact-1',
      comprobanteId: 'comp-fact-1',
      // Tipo '01'
      claveAcceso: '2809202601179001691900110010010000000011234567818',
      xmlFirmado: '<factura></factura>',
      ambiente: '1',
      estadoActualComprobante: 'FIRMADO',
      intentos: 0,
      maxIntentos: 3,
    };

    const res = await processor.procesarJob(job);
    expect(res.exito).toBe(true);
    expect(mockRepo.reintegrarStockNotaCredito).not.toHaveBeenCalled();
  });
});
