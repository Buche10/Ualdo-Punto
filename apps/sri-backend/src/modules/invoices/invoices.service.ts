import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { AccessKeyService } from '../sri/access-key.service';
import { XmlBuilderService, FacturaXmlData } from '../sri/xml-builder.service';
import { XmlSignerService } from '../sri/xml-signer.service';
import { RideGeneratorService } from '../sri/ride-generator.service';
import { SriComprobanteRepository } from '../jobs/sri-comprobante.repository';
import { SriQueueWorker } from '../jobs/sri-queue.worker';
import { calculateInvoiceTotals, CustomerSchema, SriEnvironment, round2 } from '@pharmastock/shared';
import { parseXmlToRideData } from './ride-xml-parser.util';
import { SriMailerService } from '../sri/sri-mailer.service';
import { InvoicesReconciliationService, ReemitirFacturaDto } from './invoices-reconciliation.service';

export { ReemitirFacturaDto };

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
    private readonly mailerService: SriMailerService,
    private readonly reconciliationService: InvoicesReconciliationService,
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

  public async enviarEmailFactura(claveAcceso: string, destinatario?: string) {
    const registro = await this.sriRepository.obtenerComprobantePorClave(claveAcceso);
    if (!registro) {
      throw new NotFoundException(`Comprobante con clave ${claveAcceso} no encontrado`);
    }

    const xml = registro.xml_firmado || registro.xml_generado;
    if (!xml) {
      throw new BadRequestException('El comprobante no contiene XML.');
    }

    const emailMatch = xml.match(/<campoAdicional[^>]*nombre=["'](?:Email|email|Correo|correo)["'][^>]*>([^<]+)<\/campoAdicional>/i);
    const targetEmail = destinatario || (emailMatch ? emailMatch[1].trim() : undefined);

    if (!targetEmail || !targetEmail.includes('@')) {
      throw new BadRequestException('No se especificó un correo de destinatario válido.');
    }

    const rideData = parseXmlToRideData(xml, registro.num_autorizacion, registro.fecha_autorizacion);
    const pdfBuffer = await this.rideGenerator.generarRidePdf(rideData);

    const resultado = await this.mailerService.enviarFacturaEmail({
      destinatario: targetEmail,
      numeroFactura: rideData.factura.secuencialCompleto,
      razonSocialEmisor: rideData.emisor.razonSocial,
      xmlContenido: xml,
      pdfBuffer,
    });

    const logEnvio = {
      tipo: 'ENVIO_MANUAL_EMAIL',
      destinatario: targetEmail,
      enviado: resultado.enviado,
      motivo: resultado.motivo,
      timestamp: new Date().toISOString(),
    };
    await this.sriRepository.registrarLogEnvio(registro.id, logEnvio);

    return {
      enviado: resultado.enviado,
      destinatario: targetEmail,
      motivo: resultado.motivo,
      secuencial: rideData.factura.secuencialCompleto,
      mensaje: resultado.enviado
        ? 'Factura y RIDE enviados exitosamente por correo electrónico.'
        : `No se pudo enviar el correo: ${resultado.motivo}`,
    };
  }

  public async consultarVentasSinFacturaAutorizada() {
    return this.reconciliationService.consultarVentasSinFacturaAutorizada();
  }

  public async reemitirFactura(ventaId: string, options?: ReemitirFacturaDto) {
    return this.reconciliationService.reemitirFactura(ventaId, options);
  }
}


