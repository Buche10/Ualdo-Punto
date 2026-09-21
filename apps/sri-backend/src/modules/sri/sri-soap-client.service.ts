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

  /**
   * Parsea la respuesta XML de Recepción
   */
  private parseRecepcionResponse(rawXml: string): RecepcionResponse {
    const estadoMatch = rawXml.match(/<estado>(RECIBIDA|DEVUELTA)<\/estado>/i);
    const estado = (estadoMatch ? estadoMatch[1].toUpperCase() : 'ERROR') as 'RECIBIDA' | 'DEVUELTA' | 'ERROR';

    const mensajes = this.extractMensajes(rawXml);
    return { estado, mensajes, rawResponse: rawXml };
  }

  /**
   * Parsea la respuesta XML de Autorización
   */
  private parseAutorizacionResponse(rawXml: string): AutorizacionResponse {
    const estadoMatch = rawXml.match(/<estado>(AUTORIZADO|NO AUTORIZADO|EN PROCESO)<\/estado>/i);
    const estado = (estadoMatch ? estadoMatch[1].toUpperCase() : 'ERROR') as 'AUTORIZADO' | 'NO AUTORIZADO' | 'EN PROCESO' | 'ERROR';

    const numAutMatch = rawXml.match(/<numeroAutorizacion>(\d{49})<\/numeroAutorizacion>/i);
    const fechaAutMatch = rawXml.match(/<fechaAutorizacion>(.*?)<\/fechaAutorizacion>/i);
    const comprobanteMatch = rawXml.match(/<comprobante><!\[CDATA\[([\s\S]*?)\]\]><\/comprobante>/i);

    const mensajes = this.extractMensajes(rawXml);

    return {
      estado,
      numeroAutorizacion: numAutMatch ? numAutMatch[1] : undefined,
      fechaAutorizacion: fechaAutMatch ? fechaAutMatch[1] : undefined,
      xmlComprobante: comprobanteMatch ? comprobanteMatch[1] : undefined,
      mensajes,
      rawResponse: rawXml,
    };
  }

  /**
   * Extrae los mensajes de error/advertencia del XML SOAP usando XMLParser
   */
  private extractMensajes(rawXml: string): SriMensaje[] {
    const mensajes: SriMensaje[] = [];

    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        removeNSPrefix: true,
      });
      const parsed = parser.parse(rawXml);

      // Buscar mensajes recursivamente o en rutas típicas
      const findMessages = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;

        if (obj.mensaje && typeof obj.mensaje === 'object') {
          const mList = Array.isArray(obj.mensaje) ? obj.mensaje : [obj.mensaje];
          for (const m of mList) {
            if (m && typeof m === 'object' && (m.identificador || m.mensaje)) {
              mensajes.push({
                identificador: String(m.identificador || '0'),
                mensaje: typeof m.mensaje === 'string' ? m.mensaje : String(m.identificador || ''),
                informacionAdicional: m.informacionAdicional ? String(m.informacionAdicional) : undefined,
                tipo: m.tipo ? String(m.tipo) : 'ERROR',
              });
            }
          }
        }

        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'object') {
            findMessages(obj[key]);
          }
        }
      };

      findMessages(parsed);
    } catch (e) {
      this.logger.warn(`No se pudo parsear XML de mensajes: ${(e as Error).message}`);
    }

    return mensajes;
  }
}
