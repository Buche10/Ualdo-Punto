import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SriQueueProcessor, SriJobRecord } from './sri-queue.processor';
import { SriComprobanteRepository } from './sri-comprobante.repository';
import { SriEnvironment } from '@pharmastock/shared';

@Injectable()
export class SriQueueWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SriQueueWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly processor: SriQueueProcessor,
    private readonly repository: SriComprobanteRepository,
  ) {}

  public onModuleInit() {
    const intervaloSegundos = Number(process.env.SRI_QUEUE_INTERVAL_SEC) || 5;
    this.timer = setInterval(() => {
      this.procesarColaPendiente().catch((err) => {
        this.logger.error(`Error en ciclo de cola SRI: ${(err as Error).message}`);
      });
    }, intervaloSegundos * 1000);
    this.logger.log(`Worker de cola SRI iniciado (intervalo: ${intervaloSegundos}s)`);
  }

  public onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async procesarColaPendiente(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      // 1. Rescatar jobs en estado PROCESANDO que hayan quedado colgados (> 10 minutos)
      await this.repository.rescatarJobsColgados(10);

      // 2. Obtener y reclamar jobs pendientes atómicamente
      const jobs = await this.repository.obtenerJobsPendientes(5);
      for (const job of jobs) {
        await this.processor.procesarJob(job);
      }
      return jobs.length;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Permite despachar de inmediato un job recién creado con reclamo atómico anti-duplicación
   */
  public async despacharInmediato(job: {
    id: string;
    comprobanteId: string;
    claveAcceso: string;
    xmlFirmado: string;
    ambiente?: SriEnvironment;
  }): Promise<void> {
    const jobRecord: SriJobRecord = {
      id: job.id,
      comprobanteId: job.comprobanteId,
      claveAcceso: job.claveAcceso,
      xmlFirmado: job.xmlFirmado,
      ambiente: job.ambiente || (process.env.SRI_AMBIENTE as SriEnvironment) || '1',
      estadoActualComprobante: 'FIRMADO',
      intentos: 0,
      maxIntentos: 5,
    };

    // Ejecución asíncrona sin bloquear la respuesta HTTP
    setImmediate(async () => {
      try {
        const reclamado = await this.repository.reclamarJobPorId(job.id);
        if (!reclamado) {
          this.logger.debug(`Job ${job.id} ya fue reclamado por otro worker o cron. Se omite despacho inmediato.`);
          return;
        }
        await this.processor.procesarJob(jobRecord);
      } catch (err) {
        this.logger.error(`Error en despacho inmediato del job ${job.id}: ${(err as Error).message}`);
      }
    });
  }
}
