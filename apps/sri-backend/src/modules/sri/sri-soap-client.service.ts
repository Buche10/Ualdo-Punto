import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { SriEnvironment } from '@pharmastock/shared';

export interface SriMensaje {
  identificador: string;
  mensaje: string;
  informacionAdicional?: string;
  tipo: string;
}

export interface RecepcionResponse {
  estado: 'RECIBIDA' | 'DEVUELTA' | 'ERROR';
  mensajes: SriMensaje[];
  rawResponse?: string;
}

export interface AutorizacionResponse {
  estado: 'AUTORIZADO' | 'NO AUTORIZADO' | 'EN PROCESO' | 'ERROR';
  numeroAutorizacion?: string;
  fechaAutorizacion?: string;
  xmlComprobante?: string;
  mensajes: SriMensaje[];
  rawResponse?: string;
}

@Injectable()
export class SriSoapClientService {
  private readonly logger = new Logger(SriSoapClientService.name);

  private readonly URLS = {
    '1': {
      recepcion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
      autorizacion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
    },
    '2': {
      recepcion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline',
      autorizacion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline',
    },
  };

  /**
   * Envía un comprobante XML firmado al Web Service de Recepción del SRI
   */
  public async enviarComprobante(xmlFirmado: string, ambiente: SriEnvironment = '1'): Promise<RecepcionResponse> {
    const url = this.URLS[ambiente].recepcion;
    const base64Xml = Buffer.from(xmlFirmado, 'utf-8').toString('base64');

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${base64Xml}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const response = await axios.post(url, soapEnvelope, {
        headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '' },
        timeout: 20000,
      });

      return this.parseRecepcionResponse(response.data);
    } catch (error) {
      this.logger.error(`Error en Recepción SRI: ${(error as Error).message}`);
      return {
        estado: 'ERROR',
        mensajes: [{ identificador: 'HTTP_ERR', mensaje: (error as Error).message, tipo: 'ERROR' }],
      };
    }
  }

  /**
   * Consulta el estado de autorización de un comprobante por clave de acceso
   */
  public async consultarAutorizacion(claveAcceso: string, ambiente: SriEnvironment = '1'): Promise<AutorizacionResponse> {
    const url = this.URLS[ambiente].autorizacion;

    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const response = await axios.post(url, soapEnvelope, {
        headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '' },
        timeout: 20000,
      });

      return this.parseAutorizacionResponse(response.data);
    } catch (error) {
      this.logger.error(`Error en Autorización SRI: ${(error as Error).message}`);
      return {
        estado: 'ERROR',
        mensajes: [{ identificador: 'HTTP_ERR', mensaje: (error as Error).message, tipo: 'ERROR' }],
      };
    }
  }

  private createParser(): XMLParser {
    return new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      trimValues: true,
      parseTagValue: false, // Preservar strings (ej. 49 dígitos numAutorizacion y claveAcceso)
    });
  }

  /**
   * Parsea la respuesta XML de Recepción usando XMLParser estructurado
   */
  private parseRecepcionResponse(rawXml: string): RecepcionResponse {
    try {
      const parser = this.createParser();
      const parsed = parser.parse(rawXml);
      const resp = parsed?.Envelope?.Body?.validarComprobanteResponse?.RespuestaRecepcionComprobante;
      const estado = (resp?.estado ? String(resp.estado).toUpperCase() : 'ERROR') as 'RECIBIDA' | 'DEVUELTA' | 'ERROR';
      const mensajes = this.extractMensajesFromObject(resp?.comprobantes || parsed);

      return { estado, mensajes, rawResponse: rawXml };
    } catch (err) {
      this.logger.error(`Error parseando XML de recepción: ${(err as Error).message}`);
      return { estado: 'ERROR', mensajes: [], rawResponse: rawXml };
    }
  }

  /**
   * Parsea la respuesta XML de Autorización usando XMLParser estructurado
   */
  private parseAutorizacionResponse(rawXml: string): AutorizacionResponse {
    try {
      const parser = this.createParser();
      const parsed = parser.parse(rawXml);
      const resp = parsed?.Envelope?.Body?.autorizacionComprobanteResponse?.RespuestaAutorizacionComprobante;
      const autRaw = resp?.autorizaciones?.autorizacion;
      const aut = Array.isArray(autRaw) ? autRaw[0] : autRaw;

      if (!aut) {
        return {
          estado: 'ERROR',
          mensajes: [{ identificador: 'PARSE_ERR', mensaje: 'Respuesta sin nodo autorizacion', tipo: 'ERROR' }],
          rawResponse: rawXml,
        };
      }

      const estado = (aut.estado ? String(aut.estado).toUpperCase() : 'ERROR') as 'AUTORIZADO' | 'NO AUTORIZADO' | 'EN PROCESO' | 'ERROR';
      const numeroAutorizacion = aut.numeroAutorizacion ? String(aut.numeroAutorizacion) : undefined;
      const fechaAutorizacion = aut.fechaAutorizacion ? String(aut.fechaAutorizacion) : undefined;
      const xmlComprobante = aut.comprobante ? String(aut.comprobante) : undefined;
      const mensajes = this.extractMensajesFromObject(aut.mensajes || parsed);

      return {
        estado,
        numeroAutorizacion,
        fechaAutorizacion,
        xmlComprobante,
        mensajes,
        rawResponse: rawXml,
      };
    } catch (err) {
      this.logger.error(`Error parseando XML de autorización: ${(err as Error).message}`);
      return { estado: 'ERROR', mensajes: [], rawResponse: rawXml };
    }
  }

  /**
   * Extrae los mensajes de error/advertencia del objeto parseado
   */
  private extractMensajesFromObject(root: unknown): SriMensaje[] {
    const mensajes: SriMensaje[] = [];
    if (!root || typeof root !== 'object') return mensajes;

    const traverse = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      // Estructura oficial del SRI: objeto con <identificador> y <mensaje>
      if (obj.identificador !== undefined) {
        mensajes.push({
          identificador: String(obj.identificador || '0'),
          mensaje: typeof obj.mensaje === 'string' ? obj.mensaje : String(obj.mensaje || obj.identificador || ''),
          informacionAdicional: obj.informacionAdicional ? String(obj.informacionAdicional) : undefined,
          tipo: obj.tipo ? String(obj.tipo) : 'ERROR',
        });
        return;
      }

      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') {
          traverse(obj[key]);
        }
      }
    };

    traverse(root);
    return mensajes;
  }
}
