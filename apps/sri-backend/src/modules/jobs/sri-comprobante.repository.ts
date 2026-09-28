import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { ISriComprobanteRepository, SriJobRecord } from './sri-queue.processor';
import { SriComprobanteEstado, SriEnvironment, SriJobEstado } from '@pharmastock/shared';
import { GuardarComprobanteInput, ComprobanteDbRecord } from './sri-comprobante.types';

export { GuardarComprobanteInput, ComprobanteDbRecord };

@Injectable()
export class SriComprobanteRepository implements ISriComprobanteRepository {
  private readonly logger = new Logger(SriComprobanteRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  public async obtenerSiguienteSecuencial(tipoDoc: string, estab: string, ptoEmi: string): Promise<string> {
    const client = this.supabaseService.getClientOrThrow();
    const { data, error } = await client.rpc('obtener_siguiente_secuencial', {
      p_tipo_doc: tipoDoc,
      p_estab: estab,
      p_pto_emi: ptoEmi,
    });

    if (error || !data) {
      this.logger.error(`Error en RPC obtener_siguiente_secuencial: ${error?.message || 'Sin valor'}`);
      throw new InternalServerErrorException(
        `No se pudo obtener el secuencial fiscal atómico: ${error?.message || 'Sin respuesta de BD'}`,
      );
    }

    return String(data).padStart(9, '0');
  }

  public async guardarComprobante(input: GuardarComprobanteInput): Promise<{ id: string }> {
    const client = this.supabaseService.getClientOrThrow();
    const { data, error } = await client
      .from('comprobantes')
      .insert({
        tipo_comprobante: input.tipoComprobante || '01',
        clave_acceso: input.claveAcceso,
        establecimiento: input.establecimiento,
        punto_emision: input.puntoEmision,
        secuencial: input.secuencial,
        estado: input.estado,
        xml_generado: input.xmlGenerado,
        xml_firmado: input.xmlFirmado,
        venta_id: input.ventaId || null,
      })
      .select('id')
      .single();

    if (error || !data) {
      this.logger.error(`Error al persistir comprobante ${input.claveAcceso}: ${error?.message}`);
      const err = new InternalServerErrorException(
        `Fallo crítico de persistencia en comprobantes: ${error?.message}`,
      );
      (err as any).dbError = error;
      throw err;
    }

    if (input.ventaId) {
      await client.from('ventas').update({ estado: 'FACTURADA' }).eq('id', input.ventaId);
    }

    return { id: data.id };
  }

  public async crearSriJob(comprobanteId: string, maxIntentos = 5): Promise<{ id: string }> {
    const client = this.supabaseService.getClientOrThrow();
    const { data, error } = await client
      .from('sri_jobs')
      .insert({
        comprobante_id: comprobanteId,
        tipo_tarea: 'ENVIAR_Y_AUTORIZAR',
        estado: 'PENDIENTE',
        intentos: 0,
        max_intentos: maxIntentos,
        proximo_intento: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      this.logger.error(`Error al insertar en sri_jobs para comprobante ${comprobanteId}: ${error?.message}`);
      throw new InternalServerErrorException(
        `Fallo crítico al encolar trabajo en sri_jobs: ${error?.message}`,
      );
    }

    return { id: data.id };
  }

  public async obtenerComprobantePorClave(claveAcceso: string): Promise<ComprobanteDbRecord | null> {
    const client = this.supabaseService.getClientOrThrow();
    const { data, error } = await client
      .from('comprobantes')
      .select('*')
      .eq('clave_acceso', claveAcceso)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error al consultar comprobante ${claveAcceso}: ${error.message}`);
      throw new InternalServerErrorException(`Error de base de datos: ${error.message}`);
    }

    return (data as ComprobanteDbRecord) || null;
  }

  public async obtenerComprobantePorId(id: string): Promise<ComprobanteDbRecord | null> {
    const client = this.supabaseService.getClientOrThrow();
    const { data, error } = await client.from('comprobantes').select('*').eq('id', id).maybeSingle();

    if (error) {
      this.logger.error(`Error al consultar comprobante ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error de base de datos: ${error.message}`);
    }

    return (data as ComprobanteDbRecord) || null;
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
    const client = this.supabaseService.getClientOrThrow();
    const updatePayload: Record<string, unknown> = {
      estado: cambios.estado,
      updated_at: new Date().toISOString(),
    };
    if (cambios.numAutorizacion) updatePayload.num_autorizacion = cambios.numAutorizacion;
    if (cambios.fechaAutorizacion) updatePayload.fecha_autorizacion = cambios.fechaAutorizacion;
    if (cambios.xmlFirmado) updatePayload.xml_firmado = cambios.xmlFirmado;
    if (cambios.mensajes) updatePayload.mensajes_sri = cambios.mensajes;

    const { error } = await client.from('comprobantes').update(updatePayload).eq('id', id);
    if (error) {
      this.logger.error(`Error actualizando comprobante ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error al actualizar comprobante: ${error.message}`);
    }
    return true;
  }

  public async actualizarJob(
    jobId: string,
    estado: SriJobEstado,
    detalles: { intentos?: number; proximoIntento?: Date; ultimoError?: string },
  ): Promise<boolean> {
    const client = this.supabaseService.getClientOrThrow();
    const updatePayload: Record<string, unknown> = { estado, updated_at: new Date().toISOString() };
    if (detalles.intentos !== undefined) updatePayload.intentos = detalles.intentos;
    if (detalles.proximoIntento) updatePayload.proximo_intento = detalles.proximoIntento.toISOString();
    if (detalles.ultimoError) updatePayload.ultimo_error = detalles.ultimoError;

    const { error } = await client.from('sri_jobs').update(updatePayload).eq('id', jobId);
    if (error) {
      this.logger.error(`Error actualizando job ${jobId}: ${error.message}`);
      throw new InternalServerErrorException(`Error al actualizar job en BD: ${error.message}`);
    }
    return true;
  }

  public async rescatarJobsColgados(minutos = 10): Promise<number> {
    const client = this.supabaseService.getClientOrThrow();
    const { data, error } = await client.rpc('rescatar_jobs_colgados', { p_minutos: minutos });
    if (!error && data !== null && data !== undefined) return Number(data);

    const cutoff = new Date(Date.now() - minutos * 60 * 1000).toISOString();
    const { error: updErr } = await client
      .from('sri_jobs')
      .update({ estado: 'PENDIENTE', updated_at: new Date().toISOString() })
      .eq('estado', 'PROCESANDO')
      .lt('updated_at', cutoff);
    if (updErr) this.logger.warn(`Error rescatando jobs colgados: ${updErr.message}`);
    return 0;
  }

  public async reclamarJobPorId(jobId: string): Promise<boolean> {
    const client = this.supabaseService.getClientOrThrow();
    const { data, error } = await client.rpc('reclamar_job_por_id', { p_job_id: jobId });
    if (!error && data !== null && data !== undefined) return Boolean(data);

    const { data: updated, error: updErr } = await client
      .from('sri_jobs')
      .update({ estado: 'PROCESANDO', updated_at: new Date().toISOString() })
      .eq('id', jobId)
      .eq('estado', 'PENDIENTE')
      .select('id');
    return !updErr && Array.isArray(updated) && updated.length > 0;
  }

  public async obtenerJobsPendientes(limite = 10): Promise<SriJobRecord[]> {
    const client = this.supabaseService.getClientOrThrow();
    // El reclamo de jobs DEBE ser atómico (FOR UPDATE SKIP LOCKED) para evitar
    // doble envío de un mismo comprobante al SRI. Si la RPC no está disponible,
    // se falla en fuerte en lugar de degradar a un SELECT no atómico.
    const { data: rpcData, error: rpcErr } = await client.rpc('reclamar_jobs_pendientes', { p_limite: limite });

    if (rpcErr) {
      this.logger.error(`Error en RPC reclamar_jobs_pendientes: ${rpcErr.message}`);
      throw new InternalServerErrorException(
        `No se pudo reclamar jobs de forma atómica (¿migración 20260922000002_sri_jobs_claim aplicada?): ${rpcErr.message}`,
      );
    }

    if (!Array.isArray(rpcData)) return [];

    return rpcData.map((row: any) => ({
      id: row.id,
      comprobanteId: row.comprobante_id,
      claveAcceso: row.clave_acceso || '',
      xmlFirmado: row.xml_firmado || '',
      ambiente: (process.env.SRI_AMBIENTE as SriEnvironment) || '1',
      estadoActualComprobante: row.estado_comprobante || 'FIRMADO',
      intentos: row.intentos,
      maxIntentos: row.max_intentos,
    }));
  }

  public async obtenerVentaConDetallesPorId(ventaId: string) {
    const client = this.supabaseService.getClientOrThrow();
    const { data, error } = await client
      .from('ventas')
      .select('*, clientes(*), venta_detalle(*), comprobantes(*)')
      .eq('id', ventaId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error al consultar venta ${ventaId}: ${error.message}`);
      throw new InternalServerErrorException(`Error de base de datos: ${error.message}`);
    }
    return data || null;
  }

  public async consultarVentasSinFacturaAutorizada() {
    const client = this.supabaseService.getClientOrThrow();
    const { data, error } = await client
      .from('ventas')
      .select('id, cliente_id, subtotal_0, subtotal_15, total_descuento, total_iva, importe_total, forma_pago_codigo, estado, created_at, clientes(id, tipo_identificacion, identificacion, razon_social, email, telefono, direccion), comprobantes(id, clave_acceso, establecimiento, punto_emision, secuencial, estado, created_at, updated_at)')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error al consultar ventas sin factura autorizada: ${error.message}`);
      throw new InternalServerErrorException(`Error de base de datos: ${error.message}`);
    }

    if (!Array.isArray(data)) return [];

    return data
      .filter((v: any) => {
        const comps = v.comprobantes || [];
        const tieneAutorizado = comps.some((c: any) => c.estado === 'AUTORIZADO');
        return !tieneAutorizado;
      })
      .map((v: any) => {
        const comps = v.comprobantes || [];
        const ultimoComp = comps.length > 0 ? comps[comps.length - 1] : null;
        return {
          ventaId: v.id,
          fecha: v.created_at,
          importeTotal: v.importe_total,
          formaPagoCodigo: v.forma_pago_codigo,
          estadoVenta: v.estado,
          cliente: v.clientes,
          comprobante: ultimoComp ? {
            id: ultimoComp.id,
            claveAcceso: ultimoComp.clave_acceso,
            secuencial: `${ultimoComp.establecimiento}-${ultimoComp.punto_emision}-${ultimoComp.secuencial}`,
            estado: ultimoComp.estado,
          } : null,
          motivo: ultimoComp ? ultimoComp.estado : 'SIN_COMPROBANTE',
        };
      });
  }

  public async obtenerJobPorComprobanteId(comprobanteId: string): Promise<{ id: string; estado: string; intentos: number } | null> {
    const client = this.supabaseService.getClientOrThrow();
    const { data, error } = await client
      .from('sri_jobs')
      .select('id, estado, intentos')
      .eq('comprobante_id', comprobanteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.logger.warn(`Error buscando job para comprobante ${comprobanteId}: ${error.message}`);
      return null;
    }
    return data || null;
  }

  public async reiniciarJob(jobId: string): Promise<boolean> {
    const client = this.supabaseService.getClientOrThrow();
    const { error } = await client
      .from('sri_jobs')
      .update({
        estado: 'PENDIENTE',
        intentos: 0,
        proximo_intento: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      this.logger.error(`Error al reiniciar job ${jobId}: ${error.message}`);
      throw new InternalServerErrorException(`Error al reiniciar job en BD: ${error.message}`);
    }
    return true;
  }

  public async obtenerEmisorConfig() {
    const client = this.supabaseService.getClientOrThrow();
    const { data } = await client.from('emisor').select('*').limit(1).maybeSingle();
    return data || null;
  }

  public async registrarLogEnvio(comprobanteId: string, logEnvio: Record<string, unknown>): Promise<boolean> {
    const client = this.supabaseService.getClientOrThrow();
    const { data } = await client.from('comprobantes').select('mensajes_sri').eq('id', comprobanteId).maybeSingle();
    const mensajesPrevios = Array.isArray(data?.mensajes_sri) ? data.mensajes_sri : [];
    mensajesPrevios.push(logEnvio);

    const { error } = await client
      .from('comprobantes')
      .update({
        mensajes_sri: mensajesPrevios,
        updated_at: new Date().toISOString(),
      })
      .eq('id', comprobanteId);

    if (error) {
      this.logger.warn(`No se pudo registrar log de envío para comprobante ${comprobanteId}: ${error.message}`);
      return false;
    }
    return true;
  }
}
