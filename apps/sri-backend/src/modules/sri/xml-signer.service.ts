import { Injectable, Logger } from '@nestjs/common';
import { signInvoiceXml, signCreditNoteXml } from 'ec-sri-invoice-signer';
import * as fs from 'fs';

export interface SignerConfig {
  p12Path?: string;
  p12Buffer?: Buffer;
  p12Base64?: string;
  p12Password: string;
}

@Injectable()
export class XmlSignerService {
  private readonly logger = new Logger(XmlSignerService.name);

  /**
   * Obtiene el buffer del certificado PKCS#12 desde archivo, base64 o buffer en memoria
   */
  private getCertificateBuffer(config: SignerConfig): Buffer {
    if (config.p12Buffer) {
      return config.p12Buffer;
    }
    if (config.p12Base64) {
      return Buffer.from(config.p12Base64, 'base64');
    }
    if (config.p12Path && fs.existsSync(config.p12Path)) {
      return fs.readFileSync(config.p12Path);
    }
    if (process.env.SRI_P12_BASE64) {
      return Buffer.from(process.env.SRI_P12_BASE64, 'base64');
    }
    if (process.env.SRI_P12_PATH && fs.existsSync(process.env.SRI_P12_PATH)) {
      return fs.readFileSync(process.env.SRI_P12_PATH);
    }
    throw new Error('Certificado .p12 no disponible. Configure SRI_P12_PATH o SRI_P12_BASE64.');
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
