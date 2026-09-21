import { Injectable, Logger } from '@nestjs/common';
import { signInvoiceXml, signCreditNoteXml } from 'ec-sri-invoice-signer';
import * as fs from 'fs';

export interface SignerConfig {
  p12Path?: string;
  p12Buffer?: Buffer;
  p12Password: string;
}

@Injectable()
export class XmlSignerService {
  private readonly logger = new Logger(XmlSignerService.name);

  /**
   * Obtiene el buffer del certificado PKCS#12 desde archivo o buffer en memoria
   */
  private getCertificateBuffer(config: SignerConfig): Buffer {
    if (config.p12Buffer) {
      return config.p12Buffer;
    }
    if (config.p12Path && fs.existsSync(config.p12Path)) {
      return fs.readFileSync(config.p12Path);
    }
    throw new Error('Certificado .p12 no disponible. Configure p12Path o p12Buffer.');
  }

  /**
   * Firma digitalmente una factura XML bajo el estándar XAdES-BES del SRI
   */
  public firmarFacturaXml(xmlContent: string, config: SignerConfig): string {
    const certBuffer = this.getCertificateBuffer(config);
    try {
      const xmlFirmado = signInvoiceXml(xmlContent, certBuffer, {
        pkcs12Password: config.p12Password,
      });
      return xmlFirmado;
    } catch (error) {
      this.logger.error(`Error al firmar factura XML con XAdES-BES: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Firma digitalmente una nota de crédito XML bajo el estándar XAdES-BES del SRI
   */
  public firmarNotaCreditoXml(xmlContent: string, config: SignerConfig): string {
    const certBuffer = this.getCertificateBuffer(config);
    try {
      const xmlFirmado = signCreditNoteXml(xmlContent, certBuffer, {
        pkcs12Password: config.p12Password,
      });
      return xmlFirmado;
    } catch (error) {
      this.logger.error(`Error al firmar nota de crédito XML: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Valida preliminarmente si un XML cuenta con la estructura de firma ds:Signature
   */
  public tieneFirmaDigital(xmlContent: string): boolean {
    return xmlContent.includes('<ds:Signature') && xmlContent.includes('</ds:Signature>');
  }
}
