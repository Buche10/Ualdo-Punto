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
});
