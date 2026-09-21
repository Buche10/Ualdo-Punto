import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

export interface MailerConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

export interface EnviarFacturaEmailParams {
  destinatario: string;
  numeroFactura: string;
  razonSocialEmisor: string;
  xmlContenido: string;
  pdfBuffer: Buffer;
}

@Injectable()
export class SriMailerService {
  private readonly logger = new Logger(SriMailerService.name);
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  public initTransporter(config?: MailerConfig) {
    const host = config?.host || process.env.SMTP_HOST;
    const port = config?.port || parseInt(process.env.SMTP_PORT || '587', 10);
    const user = config?.user || process.env.SMTP_USER;
    const pass = config?.pass || process.env.SMTP_PASS;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`Servicio SMTP configurado hacia ${host}:${port}`);
    } else {
      this.logger.warn('SMTP no configurado en variables de entorno. Envío de correos en modo simulación/desactivado.');
    }
  }

  /**
   * Envía la factura autorizada (XML + RIDE PDF) al correo del cliente
   */
  public async enviarFacturaEmail(params: EnviarFacturaEmailParams): Promise<{ enviado: boolean; motivo?: string }> {
    if (!params.destinatario || !params.destinatario.includes('@')) {
      return { enviado: false, motivo: 'Email de destinatario no válido o ausente' };
    }

    if (!this.transporter) {
      this.logger.log(`[SIMULACIÓN] Correo a ${params.destinatario} para factura ${params.numeroFactura} omitido (SMTP sin configurar).`);
      return { enviado: false, motivo: 'SMTP no configurado' };
    }

    const from = process.env.SMTP_FROM || 'facturacion@farmacia.com';

    try {
      await this.transporter.sendMail({
        from: `"${params.razonSocialEmisor}" <${from}>`,
        to: params.destinatario,
        subject: `Factura Electrónica ${params.numeroFactura} - ${params.razonSocialEmisor}`,
        text: `Estimado(a) cliente,\n\nAdjuntamos su comprobante electrónico y representación gráfica (RIDE) de la factura No. ${params.numeroFactura}.\n\nGracias por su compra.`,
        attachments: [
          {
            filename: `Factura_${params.numeroFactura}.xml`,
            content: params.xmlContenido,
            contentType: 'text/xml',
          },
          {
            filename: `Factura_${params.numeroFactura}.pdf`,
            content: params.pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      this.logger.log(`Factura ${params.numeroFactura} enviada exitosamente a ${params.destinatario}`);
      return { enviado: true };
    } catch (error) {
      this.logger.error(`Error al enviar factura por email: ${(error as Error).message}`);
      return { enviado: false, motivo: (error as Error).message };
    }
  }
}
