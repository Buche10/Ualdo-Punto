import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AccessKeyService } from '../sri/access-key.service';
import { XmlBuilderService, FacturaXmlData } from '../sri/xml-builder.service';
import { XmlSignerService } from '../sri/xml-signer.service';
import { SriComprobanteRepository } from '../jobs/sri-comprobante.repository';
import { SriQueueWorker } from '../jobs/sri-queue.worker';
import { calculateInvoiceTotals, round2, SriEnvironment } from '@pharmastock/shared';

export interface ReemitirFacturaDto {
  ambiente?: SriEnvironment;
  establecimiento?: string;
  puntoEmision?: string;
  certPassword?: string;
  emisor?: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    dirMatriz: string;
    dirEstablecimiento: string;
    obligadoContabilidad: 'SI' | 'NO';
    regimenRimpe?: string;
  };
}

@Injectable()
export class InvoicesReconciliationService {
  private readonly logger = new Logger(InvoicesReconciliationService.name);

  constructor(
    private readonly accessKeyService: AccessKeyService,
    private readonly xmlBuilderService: XmlBuilderService,
    private readonly xmlSignerService: XmlSignerService,
    private readonly sriRepository: SriComprobanteRepository,
    private readonly queueWorker: SriQueueWorker,
  ) {}

  public async consultarVentasSinFacturaAutorizada() {
    return this.sriRepository.consultarVentasSinFacturaAutorizada();
  }

  public async reemitirFactura(ventaId: string, options?: ReemitirFacturaDto) {
    const venta = await this.sriRepository.obtenerVentaConDetallesPorId(ventaId);
    if (!venta) {
      throw new NotFoundException(`Venta no encontrada: ${ventaId}`);
    }

    const comps: any[] = venta.comprobantes || [];
    const compAutorizado = comps.find((c) => c.estado === 'AUTORIZADO');
    if (compAutorizado) {
      throw new ConflictException(
        `La venta ${ventaId} ya cuenta con una factura legalmente AUTORIZADA ante el SRI (Clave: ${compAutorizado.clave_acceso}).`,
      );
    }

    const compEnContingencia = comps.find((c) => ['EN_CONTINGENCIA', 'FIRMADO', 'RECIBIDA'].includes(c.estado));
    if (compEnContingencia) {
      this.logger.log(
        `Reemitiendo venta ${ventaId} mediante reintento de comprobante existente ${compEnContingencia.clave_acceso} (sin duplicar secuencial ni stock).`,
      );

      let job = await this.sriRepository.obtenerJobPorComprobanteId(compEnContingencia.id);
      if (job) {
        await this.sriRepository.reiniciarJob(job.id);
      } else {
        const nuevoJob = await this.sriRepository.crearSriJob(compEnContingencia.id);
        job = { id: nuevoJob.id, estado: 'PENDIENTE', intentos: 0 };
      }

      await this.queueWorker.despacharInmediato({
        id: job.id,
        comprobanteId: compEnContingencia.id,
        claveAcceso: compEnContingencia.clave_acceso,
        xmlFirmado: compEnContingencia.xml_firmado,
        ambiente: compEnContingencia.ambiente || options?.ambiente || '1',
      });

      return {
        reemitida: true,
        estrategia: 'REINTENTO_CONTINGENCIA',
        comprobanteId: compEnContingencia.id,
        claveAcceso: compEnContingencia.clave_acceso,
        secuencial: `${compEnContingencia.establecimiento}-${compEnContingencia.punto_emision}-${compEnContingencia.secuencial}`,
        estado: compEnContingencia.estado,
        mensaje: 'Comprobante en contingencia re-encolado y despachado inmediatamente sin duplicar secuencial ni stock.',
      };
    }

    const cliente = venta.clientes;
    if (!cliente) {
      throw new BadRequestException(`La venta ${ventaId} no tiene cliente asociado.`);
    }

    const items = venta.venta_detalle || [];
    if (items.length === 0) {
      throw new BadRequestException(`La venta ${ventaId} no tiene ítems de detalle.`);
    }

    const estab = options?.establecimiento || '001';
    const ptoEmi = options?.puntoEmision || '001';
    const secuencial = await this.sriRepository.obtenerSiguienteSecuencial('01', estab, ptoEmi);

    const emisorDb = await this.sriRepository.obtenerEmisorConfig();
    const emisor = options?.emisor || (emisorDb ? {
      ruc: emisorDb.ruc,
      razonSocial: emisorDb.razon_social,
      nombreComercial: emisorDb.nombre_comercial,
      dirMatriz: emisorDb.dir_matriz,
      dirEstablecimiento: emisorDb.dir_establecimiento,
      obligadoContabilidad: emisorDb.obligado_contabilidad,
      regimenRimpe: emisorDb.regimen_rimpe,
    } : {
      ruc: process.env.SRI_RUC_EMISOR || '1790016919001',
      razonSocial: process.env.SRI_RAZON_SOCIAL || 'FARMACIA PHARMASTOCK S.A.',
      nombreComercial: process.env.SRI_NOMBRE_COMERCIAL || 'PHARMASTOCK',
      dirMatriz: process.env.SRI_DIR_MATRIZ || 'Av. Amazonas y Colón',
      dirEstablecimiento: process.env.SRI_DIR_ESTAB || 'Av. Amazonas y Colón',
      obligadoContabilidad: (process.env.SRI_OBLIGADO_CONTABILIDAD as 'SI' | 'NO') || 'SI',
      regimenRimpe: process.env.SRI_REGIMEN_RIMPE || 'CONTRIBUYENTE RÉGIMEN RIMPE',
    });

    const cartItems = items.map((it: any) => ({
      id: it.producto_id,
      codigo: it.codigo_principal,
      descripcion: it.descripcion,
      cantidad: Number(it.cantidad),
      precioUnitario: Number(it.precio_unitario),
      descuento: Number(it.descuento || 0),
      tarifaIva: Number(it.tarifa || 0),
      codigoPorcentajeIva: it.codigo_porcentaje || '0',
    }));

    const totales = calculateInvoiceTotals(cartItems);

    const fechaActual = new Date();
    const ambiente = options?.ambiente || (process.env.SRI_AMBIENTE as SriEnvironment) || '1';
    const claveAcceso = this.accessKeyService.generarClaveAcceso({
      fechaEmision: fechaActual,
      tipoComprobante: '01',
      ruc: emisor.ruc,
      ambiente,
      establecimiento: estab,
      puntoEmision: ptoEmi,
      secuencial,
      tipoEmision: '1',
    });

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fechaEmisionStr = `${pad(fechaActual.getDate())}/${pad(fechaActual.getMonth() + 1)}/${fechaActual.getFullYear()}`;

    const xmlData: FacturaXmlData = {
      ambiente,
      tipoEmision: '1',
      razonSocial: emisor.razonSocial,
      nombreComercial: emisor.nombreComercial,
      ruc: emisor.ruc,
      claveAcceso,
      codDoc: '01',
      estab,
      ptoEmi,
      secuencial,
      dirMatriz: emisor.dirMatriz,
      dirEstablecimiento: emisor.dirEstablecimiento,
      obligadoContabilidad: emisor.obligadoContabilidad,
      regimenRimpe: emisor.regimenRimpe,
      fechaEmision: fechaEmisionStr,
      comprador: {
        tipoIdentificacion: cliente.tipo_identificacion,
        identificacion: cliente.identificacion,
        razonSocial: cliente.razon_social,
        direccion: cliente.direccion,
        email: cliente.email,
        telefono: cliente.telefono,
      },
      items: items.map((it: any) => {
        const itemSinImp = round2(Number(it.cantidad) * Number(it.precio_unitario) - Number(it.descuento || 0));
        const valorIva = Number(it.tarifa) > 0 ? round2(itemSinImp * (Number(it.tarifa) / 100)) : 0;
        return {
          codigoPrincipal: it.codigo_principal,
          descripcion: it.descripcion,
          cantidad: Number(it.cantidad),
          precioUnitario: Number(it.precio_unitario),
          descuento: Number(it.descuento || 0),
          precioTotalSinImpuesto: itemSinImp,
          codigoImpuesto: it.codigo_impuesto || '2',
          codigoPorcentaje: it.codigo_porcentaje || '0',
          tarifa: Number(it.tarifa || 0),
          valorIva,
        };
      }),
      totales,
      pagos: [{ formaPago: venta.forma_pago_codigo || '01', total: totales.importeTotal }],
    };

    const xmlGenerado = this.xmlBuilderService.buildFacturaXml(xmlData);

    const certPath = process.env.SRI_P12_PATH;
    const certPassword = options?.certPassword || process.env.SRI_P12_PASSWORD;
    if (!certPath || !certPassword) {
      throw new BadRequestException('Certificado digital .p12 o contraseña no configurados. La firma electrónica es obligatoria.');
    }

    let xmlFirmado: string;
    try {
      xmlFirmado = this.xmlSignerService.firmarFacturaXml(xmlGenerado, {
        p12Path: certPath,
        p12Password: certPassword,
      });
    } catch (err) {
      this.logger.error(`Error firmando XML en re-emisión: ${(err as Error).message}`);
      throw new BadRequestException(`Fallo crítico al firmar digitalmente: ${(err as Error).message}`);
    }

    const comprobanteGuardado = await this.sriRepository.guardarComprobante({
      claveAcceso,
      establecimiento: estab,
      puntoEmision: ptoEmi,
      secuencial,
      estado: 'FIRMADO',
      xmlGenerado,
      xmlFirmado,
      ambiente,
      ventaId,
    });

    const job = await this.sriRepository.crearSriJob(comprobanteGuardado.id);
    await this.queueWorker.despacharInmediato({
      id: job.id,
      comprobanteId: comprobanteGuardado.id,
      claveAcceso,
      xmlFirmado,
      ambiente,
    });

    return {
      reemitida: true,
      estrategia: 'NUEVA_EMISION',
      id: comprobanteGuardado.id,
      jobId: job.id,
      claveAcceso,
      secuencial: `${estab}-${ptoEmi}-${secuencial}`,
      fechaEmision: fechaEmisionStr,
      totales,
      estado: 'FIRMADO',
      ambiente: ambiente === '1' ? 'PRUEBAS' : 'PRODUCCIÓN',
      mensaje: 'Factura electrónica re-emitida exitosamente sin duplicar stock.',
    };
  }
}
