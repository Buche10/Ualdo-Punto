import { describe, it, expect, vi } from 'vitest';
import { SriSoapClientService } from '../sri-soap-client.service';
import axios from 'axios';

describe('SriSoapClientService (Cliente SOAP SRI Ecuador)', () => {
  const service = new SriSoapClientService();

  it('debe parsear correctamente una respuesta RECIBIDA de Recepción', async () => {
    const mockSoapResponse = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion">
            <RespuestaRecepcionComprobante>
              <estado>RECIBIDA</estado>
              <comprobantes/>
            </RespuestaRecepcionComprobante>
          </ns2:validarComprobanteResponse>
        </soap:Body>
      </soap:Envelope>
    `;

    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      status: 200,
      data: mockSoapResponse,
    });

    const result = await service.enviarComprobante('<factura>xml</factura>', '1');

    expect(result.estado).toBe('RECIBIDA');
    expect(result.mensajes).toHaveLength(0);
  });

  it('debe parsear respuestas DEVUELTA con detalle de errores del SRI', async () => {
    const mockSoapResponse = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <ns2:validarComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.recepcion">
            <RespuestaRecepcionComprobante>
              <estado>DEVUELTA</estado>
              <comprobantes>
                <comprobante>
                  <claveAcceso>2109202601179001691900110010010000000011234567818</claveAcceso>
                  <mensajes>
                    <mensaje>
                      <identificador>45</identificador>
                      <mensaje>SECUENCIAL REGISTRADO</mensaje>
                      <informacionAdicional>El secuencial ya fue utilizado</informacionAdicional>
                      <tipo>ERROR</tipo>
                    </mensaje>
                  </mensajes>
                </comprobante>
              </comprobantes>
            </RespuestaRecepcionComprobante>
          </ns2:validarComprobanteResponse>
        </soap:Body>
      </soap:Envelope>
    `;

    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      status: 200,
      data: mockSoapResponse,
    });

    const result = await service.enviarComprobante('<factura>xml</factura>', '1');

    expect(result.estado).toBe('DEVUELTA');
    expect(result.mensajes).toHaveLength(1);
    expect(result.mensajes[0].identificador).toBe('45');
    expect(result.mensajes[0].mensaje).toBe('SECUENCIAL REGISTRADO');
  });

  it('debe parsear una respuesta AUTORIZADO de Autorización', async () => {
    const mockAuthResponse = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <ns2:autorizacionComprobanteResponse xmlns:ns2="http://ec.gob.sri.ws.autorizacion">
            <RespuestaAutorizacionComprobante>
              <claveAccesoConsultada>2109202601179001691900110010010000000011234567818</claveAccesoConsultada>
              <numeroComprobantes>1</numeroComprobantes>
              <autorizaciones>
                <autorizacion>
                  <estado>AUTORIZADO</estado>
                  <numeroAutorizacion>2109202601179001691900110010010000000011234567818</numeroAutorizacion>
                  <fechaAutorizacion>2026-09-21T17:35:00-05:00</fechaAutorizacion>
                  <ambiente>PRUEBAS</ambiente>
                  <comprobante><![CDATA[<factura>xml</factura>]]></comprobante>
                  <mensajes/>
                </autorizacion>
              </autorizaciones>
            </RespuestaAutorizacionComprobante>
          </ns2:autorizacionComprobanteResponse>
        </soap:Body>
      </soap:Envelope>
    `;

    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      status: 200,
      data: mockAuthResponse,
    });

    const result = await service.consultarAutorizacion('2109202601179001691900110010010000000011234567818', '1');

    expect(result.estado).toBe('AUTORIZADO');
    expect(result.numeroAutorizacion).toBe('2109202601179001691900110010010000000011234567818');
    expect(result.fechaAutorizacion).toBe('2026-09-21T17:35:00-05:00');
  });
});
