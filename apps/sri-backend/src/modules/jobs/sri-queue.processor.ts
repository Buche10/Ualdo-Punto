import { Injectable, Logger } from '@nestjs/common';
import { SriSoapClientService } from '../sri/sri-soap-client.service';
import { SriComprobanteEstado, SriEnvironment, SriJobEstado } from '@pharmastock/shared';

export interface SriJobRecord {
  id: string;
  comprobanteId: string;
  claveAcceso: string;
  xmlFirmado: string;
  ambiente: SriEnvironment;
  estadoActualComprobante: SriComprobanteEstado;
  intentos: number;
  maxIntentos: number;
}

export interface ISriComprobanteRepository {
  actualizarComprobante(
    id: string,
    cambios: {
      estado: SriComprobanteEstado;
      numAutorizacion?: string;
      fechaAutorizacion?: string;
      xmlFirmado?: string;
      mensajes?: unknown[];
    }
  ): Promise<boolean>;
  actualizarJob(
    jobId: string,
    estado: SriJobEstado,
    detalles: {
      intentos?: number;
      proximoIntento?: Date;
      ultimoError?: string;
    }
  ): Promise<boolean>;
}

@Injectable()
export class SriQueueProcessor {
  private readonly logger = new Logger(SriQueueProcessor.name);

  constructor(
    private readonly soapClient: SriSoapClientService,
    private readonly repository: ISriComprobanteRepository
  ) {}

  /**
   * Ejecuta el flujo transaccional de un trabajo de comprobante
   */
  public async procesarJob(job: SriJobRecord): Promise<{ exito: boolean; motivo?: string }> {
    const nuevosIntentos = job.intentos + 1;
    const esUltimoIntento = nuevosIntentos >= job.maxIntentos;

    try {
      // Paso 1: Enviar al SRI si no ha sido recibido aún
      if (job.estadoActualComprobante === 'GENERADO' || job.estadoActualComprobante === 'FIRMADO') {
        const resEnvio = await this.soapClient.enviarComprobante(job.xmlFirmado, job.ambiente);

        if (resEnvio.estado === 'DEVUELTA') {
          await this.marcarDevuelta(job, resEnvio.mensajes);
          return { exito: false, motivo: 'Comprobante DEVUELTO por el SRI' };
        }

        if (resEnvio.estado === 'ERROR') {
          return await this.manejarFalloRed(job, nuevosIntentos, esUltimoIntento, resEnvio.mensajes[0]?.mensaje);
        }

        // Marcamos como RECIBIDA
        await this.repository.actualizarComprobante(job.comprobanteId, { estado: 'RECIBIDA' });
      }

      // Paso 2: Consultar Autorización
      const resAuth = await this.soapClient.consultarAutorizacion(job.claveAcceso, job.ambiente);

      if (resAuth.estado === 'AUTORIZADO') {
        await this.marcarAutorizado(job, resAuth);
        return { exito: true };
      }

      if (resAuth.estado === 'NO AUTORIZADO') {
        await this.marcarNoAutorizado(job, resAuth.mensajes);
        return { exito: false, motivo: 'Comprobante NO AUTORIZADO por el SRI' };
      }

      // Sigue en proceso o timeout en consulta
      return await this.manejarFalloRed(job, nuevosIntentos, esUltimoIntento, 'Autorización pendiente o timeout');
    } catch (error) {
      return await this.manejarFalloRed(job, nuevosIntentos, esUltimoIntento, (error as Error).message);
    }
  }

  private async marcarDevuelta(job: SriJobRecord, mensajes: unknown[]) {
    await this.repository.actualizarComprobante(job.comprobanteId, {
      estado: 'DEVUELTA',
      mensajes,
    });
    await this.repository.actualizarJob(job.id, 'FALLIDO', {
      ultimoError: 'DEVUELTA por el SRI',
    });
  }

  private async marcarAutorizado(job: SriJobRecord, resAuth: { numeroAutorizacion?: string; fechaAutorizacion?: string; xmlComprobante?: string }) {
    await this.repository.actualizarComprobante(job.comprobanteId, {
      estado: 'AUTORIZADO',
      numAutorizacion: resAuth.numeroAutorizacion,
      fechaAutorizacion: resAuth.fechaAutorizacion,
      xmlFirmado: resAuth.xmlComprobante,
    });
    await this.repository.actualizarJob(job.id, 'EXITOSO', {});
  }

  private async marcarNoAutorizado(job: SriJobRecord, mensajes: unknown[]) {
    await this.repository.actualizarComprobante(job.comprobanteId, {
      estado: 'NO_AUTORIZADO',
      mensajes,
    });
    await this.repository.actualizarJob(job.id, 'FALLIDO', {
      ultimoError: 'NO AUTORIZADO por el SRI',
    });
  }

  private async manejarFalloRed(job: SriJobRecord, nuevosIntentos: number, esUltimoIntento: boolean, errorMsg?: string) {
    if (esUltimoIntento) {
      this.logger.warn(`Job ${job.id} agotó ${job.maxIntentos} intentos. Pasando comprobante ${job.comprobanteId} a EN_CONTINGENCIA.`);
      await this.repository.actualizarComprobante(job.comprobanteId, { estado: 'EN_CONTINGENCIA' });
      await this.repository.actualizarJob(job.id, 'FALLIDO', {
        intentos: nuevosIntentos,
        ultimoError: errorMsg || 'Agotados reintentos por caída del SRI',
      });
      return { exito: false, motivo: 'Comprobante pasado a EN_CONTINGENCIA' };
    }

    // Backoff exponencial
    const delaySegundos = Math.pow(2, nuevosIntentos) * 5;
    const proximoIntento = new Date(Date.now() + delaySegundos * 1000);

    await this.repository.actualizarJob(job.id, 'PENDIENTE', {
      intentos: nuevosIntentos,
      proximoIntento,
      ultimoError: errorMsg,
    });

    return { exito: false, motivo: 'Reintento programado' };
  }
}
