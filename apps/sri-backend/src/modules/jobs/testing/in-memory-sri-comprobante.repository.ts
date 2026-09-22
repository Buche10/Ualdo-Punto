import { ISriComprobanteRepository, SriJobRecord } from '../sri-queue.processor';
import { SriComprobanteEstado, SriJobEstado } from '@pharmastock/shared';
import { GuardarComprobanteInput, ComprobanteDbRecord } from '../sri-comprobante.types';

export class InMemorySriComprobanteRepository implements ISriComprobanteRepository {
  public readonly comprobantes = new Map<string, ComprobanteDbRecord>();
  public readonly jobs = new Map<string, SriJobRecord & { proximoIntento: Date; ultimoError?: string; updatedAt: Date }>();
  private secuencialCounter = 1;

  public async obtenerSiguienteSecuencial(_tipoDoc: string, _estab: string, _ptoEmi: string): Promise<string> {
    const sec = this.secuencialCounter++;
    return String(sec).padStart(9, '0');
  }

  public async guardarComprobante(input: GuardarComprobanteInput): Promise<{ id: string }> {
    if (this.comprobantes.has(input.claveAcceso)) {
      const err = new Error(`duplicate key value violates unique constraint "comprobantes_clave_acceso_key"`);
      (err as any).code = '23505';
      throw err;
    }

    const id = `comp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: ComprobanteDbRecord = {
      id,
      clave_acceso: input.claveAcceso,
      establecimiento: input.establecimiento,
      punto_emision: input.puntoEmision,
      secuencial: input.secuencial,
      estado: input.estado,
      xml_generado: input.xmlGenerado,
      xml_firmado: input.xmlFirmado,
    };
    this.comprobantes.set(input.claveAcceso, record);
    return { id };
  }

  public async crearSriJob(comprobanteId: string, maxIntentos = 5): Promise<{ id: string }> {
    const id = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const comp = this.obtenerComprobantePorIdSync(comprobanteId);

    this.jobs.set(id, {
      id,
      comprobanteId,
      claveAcceso: comp?.clave_acceso || '',
      xmlFirmado: comp?.xml_firmado || '',
      ambiente: '1',
      estadoActualComprobante: comp?.estado || 'FIRMADO',
      intentos: 0,
      maxIntentos,
      proximoIntento: new Date(),
      updatedAt: new Date(),
    });
    return { id };
  }

  public async obtenerComprobantePorClave(claveAcceso: string): Promise<ComprobanteDbRecord | null> {
    return this.comprobantes.get(claveAcceso) || null;
  }

  public async obtenerComprobantePorId(id: string): Promise<ComprobanteDbRecord | null> {
    return this.obtenerComprobantePorIdSync(id);
  }

  private obtenerComprobantePorIdSync(id: string): ComprobanteDbRecord | null {
    for (const comp of this.comprobantes.values()) {
      if (comp.id === id) return comp;
    }
    return null;
  }

  public async actualizarComprobante(
    id: string,
    cambios: {
      estado: SriComprobanteEstado;
      numAutorizacion?: string;
      fechaAutorizacion?: string;
      xmlFirmado?: string;
      mensajes?: unknown[];
    },
  ): Promise<boolean> {
    const comp = this.obtenerComprobantePorIdSync(id);
    if (!comp) return false;
    comp.estado = cambios.estado;
    if (cambios.numAutorizacion) comp.num_autorizacion = cambios.numAutorizacion;
    if (cambios.fechaAutorizacion) comp.fecha_autorizacion = cambios.fechaAutorizacion;
    if (cambios.xmlFirmado) comp.xml_firmado = cambios.xmlFirmado;
    if (cambios.mensajes) comp.mensajes_sri = cambios.mensajes;
    return true;
  }

  public async actualizarJob(
    jobId: string,
    estado: SriJobEstado,
    detalles: { intentos?: number; proximoIntento?: Date; ultimoError?: string },
  ): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.estadoActualComprobante = estado as any;
    job.updatedAt = new Date();
    if (detalles.intentos !== undefined) job.intentos = detalles.intentos;
    if (detalles.proximoIntento) job.proximoIntento = detalles.proximoIntento;
    if (detalles.ultimoError) job.ultimoError = detalles.ultimoError;
    return true;
  }

  public async obtenerJobsPendientes(limite = 10): Promise<SriJobRecord[]> {
    const pendientes: SriJobRecord[] = [];
    const now = new Date();
    for (const job of this.jobs.values()) {
      if (job.estadoActualComprobante === 'FIRMADO' || (job as any).estado === 'PENDIENTE') {
        if (job.proximoIntento <= now) {
          pendientes.push(job);
          if (pendientes.length >= limite) break;
        }
      }
    }
    return pendientes;
  }

  public async reclamarJobPorId(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || (job as any).estado === 'PROCESANDO') return false;
    (job as any).estado = 'PROCESANDO';
    job.updatedAt = new Date();
    return true;
  }

  public async rescatarJobsColgados(minutos = 10): Promise<number> {
    let rescatados = 0;
    const cutoff = new Date(Date.now() - minutos * 60 * 1000);
    for (const job of this.jobs.values()) {
      if ((job as any).estado === 'PROCESANDO' && job.updatedAt < cutoff) {
        (job as any).estado = 'PENDIENTE';
        job.updatedAt = new Date();
        rescatados++;
      }
    }
    return rescatados;
  }
}
