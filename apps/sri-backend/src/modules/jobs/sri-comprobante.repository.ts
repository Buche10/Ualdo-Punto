import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ISriComprobanteRepository, SriJobRecord } from './sri-queue.processor';
import { SriComprobanteEstado, SriEnvironment, SriJobEstado } from '@pharmastock/shared';
import {
  GuardarComprobanteInput,
  ComprobanteDbRecord,
  GuardarNotaCreditoDetalleInput,
} from './sri-comprobante.types';

export { GuardarComprobanteInput, ComprobanteDbRecord, GuardarNotaCreditoDetalleInput };

@Injectable()
export class SriComprobanteRepository implements ISriComprobanteRepository {
  private readonly logger = new Logger(SriComprobanteRepository.name);

  constructor(private readonly databaseService: DatabaseService) {}

  public async obtenerSiguienteSecuencial(
    tipoDoc: string,
    estab: string,
    ptoEmi: string,
  ): Promise<string> {
    try {
      const rows = await this.databaseService.query<{ sec: string }>(
        'SELECT public.obtener_siguiente_secuencial($1, $2, $3) AS sec',
        [tipoDoc, estab, ptoEmi],
      );
      if (!rows || rows.length === 0 || !rows[0].sec) {
        throw new Error('Sin valor');
      }
      return String(rows[0].sec).padStart(9, '0');
    } catch (err: any) {
      this.logger.error(
        `Error en RPC obtener_siguiente_secuencial: ${err.message || 'Sin valor'}`,
      );
      throw new InternalServerErrorException(
        `No se pudo obtener el secuencial fiscal atomico: ${err.message || 'Sin respuesta de BD'}`,
      );
    }
  }

  public async guardarComprobante(input: GuardarComprobanteInput): Promise<{ id: string }> {
    try {
      return await this.databaseService.withTransaction(async (client) => {
        const insertSql = `
          INSERT INTO public.comprobantes (
            tipo_comprobante, clave_acceso, establecimiento, punto_emision,
            secuencial, estado, xml_generado, xml_firmado, venta_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `;
        const res = await client.query(insertSql, [
          input.tipoComprobante || '01',
          input.claveAcceso,
          input.establecimiento,
          input.puntoEmision,
          input.secuencial,
          input.estado,
          input.xmlGenerado,
          input.xmlFirmado,
          input.ventaId || null,
        ]);

        if (!res.rows || res.rows.length === 0) {
          throw new Error('No se genero ID para el comprobante');
        }

        if (input.ventaId) {
          await client.query('UPDATE public.ventas SET estado = $1 WHERE id = $2', [
            'FACTURADA',
            input.ventaId,
          ]);
        }

        return { id: res.rows[0].id };
      });
    } catch (error: any) {
      this.logger.error(`Error al persistir comprobante ${input.claveAcceso}: ${error.message}`);
      const err = new InternalServerErrorException(
        `Fallo critico de persistencia en comprobantes: ${error.message}`,
      );
      (err as any).dbError = error;
      throw err;
    }
  }

  public async crearSriJob(comprobanteId: string, maxIntentos = 5): Promise<{ id: string }> {
    try {
      const sql = `
        INSERT INTO public.sri_jobs (
          comprobante_id, tipo_tarea, estado, intentos, max_intentos, proximo_intento
        ) VALUES ($1, 'ENVIAR_Y_AUTORIZAR', 'PENDIENTE', 0, $2, now())
        RETURNING id
      `;
      const rows = await this.databaseService.query<{ id: string }>(sql, [
        comprobanteId,
        maxIntentos,
      ]);
      if (!rows || rows.length === 0) {
        throw new Error('No se retorno ID del job insertado');
      }
      return { id: rows[0].id };
    } catch (error: any) {
      this.logger.error(
        `Error al insertar en sri_jobs para comprobante ${comprobanteId}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Fallo critico al encolar trabajo en sri_jobs: ${error.message}`,
      );
    }
  }

  public async obtenerComprobantePorClave(claveAcceso: string): Promise<ComprobanteDbRecord | null> {
    try {
      const rows = await this.databaseService.query<ComprobanteDbRecord>(
        'SELECT * FROM public.comprobantes WHERE clave_acceso = $1',
        [claveAcceso],
      );
      return rows[0] || null;
    } catch (error: any) {
      this.logger.error(`Error al consultar comprobante ${claveAcceso}: ${error.message}`);
      throw new InternalServerErrorException(`Error de base de datos: ${error.message}`);
    }
  }

  public async obtenerComprobantePorId(id: string): Promise<ComprobanteDbRecord | null> {
    try {
      const rows = await this.databaseService.query<ComprobanteDbRecord>(
        'SELECT * FROM public.comprobantes WHERE id = $1',
        [id],
      );
      return rows[0] || null;
    } catch (error: any) {
      this.logger.error(`Error al consultar comprobante ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error de base de datos: ${error.message}`);
    }
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
    try {
      const sets: string[] = ['updated_at = now()'];
      const params: any[] = [id];
      let idx = 2;

      if (cambios.estado) {
        sets.push(`estado = $${idx++}`);
        params.push(cambios.estado);
      }
      if (cambios.numAutorizacion) {
        sets.push(`num_autorizacion = $${idx++}`);
        params.push(cambios.numAutorizacion);
      }
      if (cambios.fechaAutorizacion) {
        sets.push(`fecha_autorizacion = $${idx++}`);
        params.push(cambios.fechaAutorizacion);
      }
      if (cambios.xmlFirmado) {
        sets.push(`xml_firmado = $${idx++}`);
        params.push(cambios.xmlFirmado);
      }
      if (cambios.mensajes) {
        sets.push(`mensajes_sri = $${idx++}`);
        params.push(JSON.stringify(cambios.mensajes));
      }

      const sql = `UPDATE public.comprobantes SET ${sets.join(', ')} WHERE id = $1`;
      await this.databaseService.query(sql, params);
      return true;
    } catch (error: any) {
      this.logger.error(`Error actualizando comprobante ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error al actualizar comprobante: ${error.message}`);
    }
  }

  public async actualizarJob(
    jobId: string,
    estado: SriJobEstado,
    detalles: { intentos?: number; proximoIntento?: Date; ultimoError?: string },
  ): Promise<boolean> {
    try {
      const sets: string[] = [`estado = $2`, `updated_at = now()`];
      const params: any[] = [jobId, estado];
      let idx = 3;

      if (detalles.intentos !== undefined) {
        sets.push(`intentos = $${idx++}`);
        params.push(detalles.intentos);
      }
      if (detalles.proximoIntento) {
        sets.push(`proximo_intento = $${idx++}`);
        params.push(detalles.proximoIntento.toISOString());
      }
      if (detalles.ultimoError !== undefined) {
        sets.push(`ultimo_error = $${idx++}`);
        params.push(detalles.ultimoError);
      }

      const sql = `UPDATE public.sri_jobs SET ${sets.join(', ')} WHERE id = $1`;
      await this.databaseService.query(sql, params);
      return true;
    } catch (error: any) {
      this.logger.error(`Error actualizando job ${jobId}: ${error.message}`);
      throw new InternalServerErrorException(`Error al actualizar job en BD: ${error.message}`);
    }
  }

  public async rescatarJobsColgados(minutos = 10): Promise<number> {
    try {
      const rows = await this.databaseService.query<{ rescatados: number }>(
        'SELECT public.rescatar_jobs_colgados($1) AS rescatados',
        [minutos],
      );
      if (rows && rows.length > 0 && rows[0].rescatados !== null && rows[0].rescatados !== undefined) {
        return Number(rows[0].rescatados);
      }
    } catch (err: any) {
      this.logger.warn(`Error llamando a rescatar_jobs_colgados: ${err.message}`);
    }

    try {
      const sql = `
        UPDATE public.sri_jobs
        SET estado = 'PENDIENTE', updated_at = now()
        WHERE estado = 'PROCESANDO'
          AND updated_at < (now() - ($1 || ' minutes')::interval)
      `;
      await this.databaseService.query(sql, [minutos]);
    } catch (updErr: any) {
      this.logger.warn(`Error rescatando jobs colgados con fallback: ${updErr.message}`);
    }
    return 0;
  }

  public async reclamarJobPorId(jobId: string): Promise<boolean> {
    try {
      const rows = await this.databaseService.query<{ reclamado: boolean }>(
        'SELECT public.reclamar_job_por_id($1) AS reclamado',
        [jobId],
      );
      if (rows && rows.length > 0 && rows[0].reclamado !== null && rows[0].reclamado !== undefined) {
        return Boolean(rows[0].reclamado);
      }
    } catch (err: any) {
      this.logger.warn(`Error llamando a reclamar_job_por_id: ${err.message}`);
    }

    try {
      const sql = `
        UPDATE public.sri_jobs
        SET estado = 'PROCESANDO', updated_at = now()
        WHERE id = $1 AND estado = 'PENDIENTE'
        RETURNING id
      `;
      const rows = await this.databaseService.query(sql, [jobId]);
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return false;
    }
  }

  public async obtenerJobsPendientes(limite = 10): Promise<SriJobRecord[]> {
    try {
      const rows = await this.databaseService.query<any>(
        'SELECT * FROM public.reclamar_jobs_pendientes($1)',
        [limite],
      );
      if (!Array.isArray(rows)) return [];

      return rows.map((row: any) => ({
        id: row.id,
        comprobanteId: row.comprobante_id,
        claveAcceso: (row.clave_acceso || '').trim(),
        xmlFirmado: row.xml_firmado || '',
        ambiente: (process.env.SRI_AMBIENTE as SriEnvironment) || '1',
        estadoActualComprobante: row.estado_comprobante || 'FIRMADO',
        intentos: row.intentos,
        maxIntentos: row.max_intentos,
      }));
    } catch (rpcErr: any) {
      this.logger.error(`Error en RPC reclamar_jobs_pendientes: ${rpcErr.message}`);
      throw new InternalServerErrorException(
        `No se pudo reclamar jobs de forma atomica: ${rpcErr.message}`,
      );
    }
  }

  public async obtenerVentaConDetallesPorId(ventaId: string) {
    try {
      const sql = `
        SELECT v.*,
          row_to_json(c.*) AS clientes,
          COALESCE((SELECT json_agg(vd.*) FROM public.venta_detalle vd WHERE vd.venta_id = v.id), '[]'::json) AS venta_detalle,
          COALESCE((SELECT json_agg(comp.*) FROM public.comprobantes comp WHERE comp.venta_id = v.id), '[]'::json) AS comprobantes
        FROM public.ventas v
        LEFT JOIN public.clientes c ON c.id = v.cliente_id
        WHERE v.id = $1
      `;
      const rows = await this.databaseService.query(sql, [ventaId]);
      return rows[0] || null;
    } catch (error: any) {
      this.logger.error(`Error al consultar venta ${ventaId}: ${error.message}`);
      throw new InternalServerErrorException(`Error de base de datos: ${error.message}`);
    }
  }

  public async consultarVentasSinFacturaAutorizada() {
    try {
      const sql = `
        SELECT v.id, v.cliente_id, v.subtotal_0, v.subtotal_15, v.total_descuento, v.total_iva,
               v.importe_total, v.forma_pago_codigo, v.estado, v.created_at,
          row_to_json(c.*) AS clientes,
          COALESCE((SELECT json_agg(comp.* ORDER BY comp.created_at ASC) FROM public.comprobantes comp WHERE comp.venta_id = v.id), '[]'::json) AS comprobantes
        FROM public.ventas v
        LEFT JOIN public.clientes c ON c.id = v.cliente_id
        ORDER BY v.created_at DESC
      `;
      const data = await this.databaseService.query(sql);
      if (!Array.isArray(data)) return [];

      return data
        .filter((v: any) => {
          const comps = v.comprobantes || [];
          return !comps.some((c: any) => c.estado === 'AUTORIZADO');
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
            comprobante: ultimoComp
              ? {
                  id: ultimoComp.id,
                  claveAcceso: ultimoComp.clave_acceso,
                  secuencial: `${ultimoComp.establecimiento}-${ultimoComp.punto_emision}-${ultimoComp.secuencial}`,
                  estado: ultimoComp.estado,
                }
              : null,
            motivo: ultimoComp ? ultimoComp.estado : 'SIN_COMPROBANTE',
          };
        });
    } catch (error: any) {
      this.logger.error(`Error al consultar ventas sin factura autorizada: ${error.message}`);
      throw new InternalServerErrorException(`Error de base de datos: ${error.message}`);
    }
  }

  public async obtenerJobPorComprobanteId(
    comprobanteId: string,
  ): Promise<{ id: string; estado: string; intentos: number } | null> {
    try {
      const sql = `
        SELECT id, estado, intentos
        FROM public.sri_jobs
        WHERE comprobante_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const rows = await this.databaseService.query<{ id: string; estado: string; intentos: number }>(
        sql,
        [comprobanteId],
      );
      return rows[0] || null;
    } catch (error: any) {
      this.logger.warn(`Error buscando job para comprobante ${comprobanteId}: ${error.message}`);
      return null;
    }
  }

  public async reiniciarJob(jobId: string): Promise<boolean> {
    try {
      const sql = `
        UPDATE public.sri_jobs
        SET estado = 'PENDIENTE',
            intentos = 0,
            proximo_intento = now(),
            updated_at = now()
        WHERE id = $1
      `;
      await this.databaseService.query(sql, [jobId]);
      return true;
    } catch (error: any) {
      this.logger.error(`Error al reiniciar job ${jobId}: ${error.message}`);
      throw new InternalServerErrorException(`Error al reiniciar job en BD: ${error.message}`);
    }
  }

  public async obtenerEmisorConfig() {
    try {
      const rows = await this.databaseService.query('SELECT * FROM public.emisor LIMIT 1');
      return rows[0] || null;
    } catch (error: any) {
      this.logger.warn(`Error obteniendo configuracion del emisor: ${error.message}`);
      return null;
    }
  }

  public async registrarLogEnvio(
    comprobanteId: string,
    logEnvio: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const sql = `
        UPDATE public.comprobantes
        SET mensajes_sri = COALESCE(mensajes_sri, '[]'::jsonb) || $1::jsonb,
            updated_at = now()
        WHERE id = $2
      `;
      await this.databaseService.query(sql, [JSON.stringify([logEnvio]), comprobanteId]);
      return true;
    } catch (error: any) {
      this.logger.warn(
        `No se pudo registrar log de envio para comprobante ${comprobanteId}: ${error.message}`,
      );
      return false;
    }
  }

  public async guardarDetallesNotaCredito(
    detalles: GuardarNotaCreditoDetalleInput[],
  ): Promise<boolean> {
    if (!detalles || detalles.length === 0) return true;
    try {
      await this.databaseService.withTransaction(async (client) => {
        const sql = `
          INSERT INTO public.nota_credito_detalle (
            comprobante_id, producto_id, codigo_principal, descripcion,
            cantidad, precio_unitario, descuento, precio_total_sin_impuesto,
            codigo_impuesto, codigo_porcentaje, tarifa, valor_iva, stock_reintegrado
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false)
        `;
        for (const d of detalles) {
          await client.query(sql, [
            d.comprobanteId,
            d.productoId,
            d.codigoPrincipal || null,
            d.descripcion,
            d.cantidad,
            d.precioUnitario,
            d.descuento || 0,
            d.precioTotalSinImpuesto,
            d.codigoImpuesto || '2',
            d.codigoPorcentaje,
            d.tarifa,
            d.valorIva,
          ]);
        }
      });
      return true;
    } catch (error: any) {
      this.logger.error(`Error persistiendo detalles de nota de credito: ${error.message}`);
      throw new InternalServerErrorException(
        `Error al guardar detalles de nota de credito: ${error.message}`,
      );
    }
  }

  public async reintegrarStockNotaCredito(comprobanteId: string): Promise<boolean> {
    try {
      const rows = await this.databaseService.query<{ reintegrado: boolean }>(
        'SELECT public.reintegrar_stock_nota_credito($1) AS reintegrado',
        [comprobanteId],
      );
      if (!rows || rows.length === 0) {
        throw new Error('Sin respuesta de BD');
      }
      return Boolean(rows[0].reintegrado);
    } catch (error: any) {
      this.logger.error(
        `Error critico en RPC reintegrar_stock_nota_credito (${comprobanteId}): ${error.message}`,
      );
      throw new InternalServerErrorException(
        `Fallo al reintegrar stock de nota de credito: ${error.message}`,
      );
    }
  }
}
