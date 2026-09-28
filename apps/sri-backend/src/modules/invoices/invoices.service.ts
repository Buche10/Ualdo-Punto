import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { AccessKeyService } from '../sri/access-key.service';
import { XmlBuilderService, FacturaXmlData } from '../sri/xml-builder.service';
import { XmlSignerService } from '../sri/xml-signer.service';
import { RideGeneratorService } from '../sri/ride-generator.service';
import { SriComprobanteRepository } from '../jobs/sri-comprobante.repository';
import { SriQueueWorker } from '../jobs/sri-queue.worker';
import { calculateInvoiceTotals, CustomerSchema, SriEnvironment, round2 } from '@pharmastock/shared';
import { parseXmlToRideData } from './ride-xml-parser.util';

export interface EmitirFacturaDto {
  ambiente?: SriEnvironment;
  emisor: {
    ruc: string;
    razonSocial: string;
    nombreComercial?: string;
    dirMatriz: string;
    dirEstablecimiento: string;
    obligadoContabilidad: 'SI' | 'NO';
    regimenRimpe?: string;
  };
  establecimiento: string; // '001'
  puntoEmision: string;    // '001'
  secuencial?: string;     // Opcional: si no se envía, se obtiene atómicamente de la BD
  comprador: {
    tipoIdentificacion: '04' | '05' | '06' | '07' | '08';
    identificacion: string;
    razonSocial: string;
    direccion?: string;
    telefono?: string;
    email?: string;
  };
  items: Array<{
    id: string;
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    tarifaIva: number; // 0 o 15
    codigoPorcentajeIva: string; // '0' o '4'
  }>;
  formaPagoCodigo: string; // '01', '20'
  certPassword?: string;
  ventaId?: string;
}

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
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly accessKeyService: AccessKeyService,
    private readonly xmlBuilderService: XmlBuilderService,
    private readonly xmlSignerService: XmlSignerService,
    private readonly rideGenerator: RideGeneratorService,
    private readonly sriRepository: SriComprobanteRepository,
    private readonly queueWorker: SriQueueWorker,
  ) {}

  public async emitirFactura(dto: EmitirFacturaDto) {
    // 1. Validar comprador con Zod
    const clienteValido = CustomerSchema.safeParse(dto.comprador);
    if (!clienteValido.success) {
      throw new BadRequestException(`Datos de cliente inválidos: ${clienteValido.error.issues.map(i => i.message).join(', ')}`);
    }

    // 2. Totales tributarios con redondeo estricto
    const totales = calculateInvoiceTotals(dto.items);
    if (dto.comprador.tipoIdentificacion === '07' && totales.excedeLimiteConsumidorFinal) {
      throw new BadRequestException('Para ventas a Consumidor Final superiores a $50.00 USD es obligatorio identificar al cliente con RUC o Cédula (Resolución SRI).');
    }

    // 3. Obtener secuencial atómico de PostgreSQL si no fue fijado manualmente (C3)
    const secuencial = dto.secuencial?.trim()
      ? dto.secuencial.padStart(9, '0')
      : await this.sriRepository.obtenerSiguienteSecuencial('01', dto.establecimiento, dto.puntoEmision);

    // 4. Clave de Acceso (49 dígitos)
    const fechaActual = new Date();
    const ambiente = dto.ambiente || (process.env.SRI_AMBIENTE as SriEnvironment) || '1';
    const claveAcceso = this.accessKeyService.generarClaveAcceso({
      fechaEmision: fechaActual,
      tipoComprobante: '01',
      ruc: dto.emisor.ruc,
      ambiente,
      establecimiento: dto.establecimiento,
      puntoEmision: dto.puntoEmision,
      secuencial,
      tipoEmision: '1',
    });

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fechaEmisionStr = `${pad(fechaActual.getDate())}/${pad(fechaActual.getMonth() + 1)}/${fechaActual.getFullYear()}`;

    // 5. Construir XML Factura v2.1.0 respetando orden XSD (H1 y H2)
    const xmlData: FacturaXmlData = {
      ambiente,
      tipoEmision: '1',
      razonSocial: dto.emisor.razonSocial,
      nombreComercial: dto.emisor.nombreComercial,
      ruc: dto.emisor.ruc,
      claveAcceso,
      codDoc: '01',
      estab: dto.establecimiento,
      ptoEmi: dto.puntoEmision,
      secuencial,
      dirMatriz: dto.emisor.dirMatriz,
      dirEstablecimiento: dto.emisor.dirEstablecimiento,
      obligadoContabilidad: dto.emisor.obligadoContabilidad,
      regimenRimpe: dto.emisor.regimenRimpe,
      fechaEmision: fechaEmisionStr,
      comprador: dto.comprador,
      items: dto.items.map(item => {
        const itemSinImp = round2(item.cantidad * item.precioUnitario - item.descuento);
        const valorIva = item.tarifaIva > 0 ? round2(itemSinImp * (item.tarifaIva / 100)) : 0;
        return {
          codigoPrincipal: item.codigo,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          descuento: item.descuento,
          precioTotalSinImpuesto: itemSinImp,
          codigoImpuesto: '2',
          codigoPorcentaje: item.codigoPorcentajeIva,
          tarifa: item.tarifaIva,
          valorIva,
        };
      }),
      totales,
      pagos: [{ formaPago: dto.formaPagoCodigo, total: totales.importeTotal }],
    };

    const xmlGenerado = this.xmlBuilderService.buildFacturaXml(xmlData);

    // 6. Firma electrónica OBLIGATORIA (H3: Hard stop si falta certificado o falla firma)
    const certPath = process.env.SRI_P12_PATH;
    const certPassword = dto.certPassword || process.env.SRI_P12_PASSWORD;

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
      this.logger.error(`Error crítico firmando XML con XAdES-BES: ${(err as Error).message}`);
      throw new BadRequestException(`Fallo crítico al firmar digitalmente el comprobante: ${(err as Error).message}`);
    }

    // 7. Persistir comprobante inmutable en base de datos (C1)
    let comprobanteGuardado: { id: string };
    try {
      comprobanteGuardado = await this.sriRepository.guardarComprobante({
        claveAcceso,
        establecimiento: dto.establecimiento,
        puntoEmision: dto.puntoEmision,
        secuencial,
        estado: 'FIRMADO',
        xmlGenerado,
        xmlFirmado,
        ambiente,
        ventaId: dto.ventaId,
      });
    } catch (err: any) {
      const isDuplicate = err?.code === '23505' || err?.dbError?.code === '23505' || /unique|duplicate/i.test(String(err?.message));
      if (isDuplicate) {
        throw new ConflictException(`El comprobante con clave de acceso ${claveAcceso} ya fue registrado previamente.`);
      }
      throw err;
    }

    // 8. Crear job y encolar para transmisión asíncrona al SRI (C2)
    const job = await this.sriRepository.crearSriJob(comprobanteGuardado.id);
    await this.queueWorker.despacharInmediato({
      id: job.id,
      comprobanteId: comprobanteGuardado.id,
      claveAcceso,
      xmlFirmado,
      ambiente,
    });

    return {
      id: comprobanteGuardado.id,
      jobId: job.id,
      claveAcceso,
      secuencial: `${dto.establecimiento}-${dto.puntoEmision}-${secuencial}`,
      fechaEmision: fechaEmisionStr,
      totales,
      estado: 'FIRMADO',
      ambiente: ambiente === '1' ? 'PRUEBAS' : 'PRODUCCIÓN',
    };
  }

  public async obtenerRidePdf(claveAcceso: string): Promise<Buffer> {
    const registro = await this.sriRepository.obtenerComprobantePorClave(claveAcceso);
    if (!registro) {
      throw new NotFoundException(`Comprobante con clave ${claveAcceso} no encontrado`);
    }

    const xml = registro.xml_firmado || registro.xml_generado;
    const rideData = parseXmlToRideData(xml, registro.num_autorizacion, registro.fecha_autorizacion);
    return await this.rideGenerator.generarRidePdf(rideData);
  }

  public async obtenerXml(claveAcceso: string): Promise<string> {
    const registro = await this.sriRepository.obtenerComprobantePorClave(claveAcceso);
    if (!registro) throw new NotFoundException(`Comprobante con clave ${claveAcceso} no encontrado`);
    return registro.xml_firmado || registro.xml_generado;
  }

  public async obtenerEstado(claveAcceso: string) {
    const c = await this.sriRepository.obtenerComprobantePorClave(claveAcceso);
    if (!c) throw new NotFoundException(`Comprobante ${claveAcceso} no encontrado`);
    return {
      id: c.id,
      claveAcceso: c.clave_acceso,
      estado: c.estado,
      numAutorizacion: c.num_autorizacion,
      fechaAutorizacion: c.fecha_autorizacion,
      mensajes: c.mensajes_sri || [],
      ventaId: c.venta_id,
    };
  }

  public async consultarVentasSinFacturaAutorizada() {
    return this.sriRepository.consultarVentasSinFacturaAutorizada();
  }

  public async reemitirFactura(ventaId: string, options?: ReemitirFacturaDto) {
    // 1. Obtener la venta persistida con cliente, items y comprobantes previos
    const venta = await this.sriRepository.obtenerVentaConDetallesPorId(ventaId);
    if (!venta) {
      throw new NotFoundException(`Venta no encontrada: ${ventaId}`);
    }

    // 2. Verificar si ya cuenta con factura AUTORIZADA
    const comps: any[] = venta.comprobantes || [];
    const compAutorizado = comps.find((c) => c.estado === 'AUTORIZADO');
    if (compAutorizado) {
      throw new ConflictException(
        `La venta ${ventaId} ya cuenta con una factura legalmente AUTORIZADA ante el SRI (Clave: ${compAutorizado.clave_acceso}).`,
      );
    }

    // 3. Caso A: Si ya tiene un comprobante emitido en contingencia (o firmado/recibida),
    // reintentar el comprobante existente SIN generar nuevo secuencial ni tocar stock.
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

    // 4. Caso B: La venta NO tiene comprobante válido o el anterior fue rechazado/devuelto.
    // Se genera nueva factura electrónica con nuevo secuencial atómico, SIN TOCAR EL STOCK (stock ya descontado).
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

    // Obtener datos del emisor
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


