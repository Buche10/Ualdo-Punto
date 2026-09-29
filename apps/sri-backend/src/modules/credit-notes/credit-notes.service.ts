import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AccessKeyService } from '../sri/access-key.service';
import { XmlBuilderService, NotaCreditoXmlData } from '../sri/xml-builder.service';
import { XmlSignerService } from '../sri/xml-signer.service';
import { SriComprobanteRepository } from '../jobs/sri-comprobante.repository';
import { SriQueueWorker } from '../jobs/sri-queue.worker';
import { SupabaseService } from '../database/supabase.service';
import { calculateInvoiceTotals, round2, SriEnvironment, CartItem } from '@pharmastock/shared';
import { EmitirNotaCreditoDto } from './credit-notes.dto';
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export class CreditNotesService {
  private readonly logger = new Logger(CreditNotesService.name);

  constructor(
    private readonly accessKeyService: AccessKeyService,
    private readonly xmlBuilderService: XmlBuilderService,
    private readonly xmlSignerService: XmlSignerService,
    private readonly sriRepository: SriComprobanteRepository,
    private readonly queueWorker: SriQueueWorker,
    private readonly supabaseService: SupabaseService,
  ) {}

  public async emitirNotaCredito(dto: EmitirNotaCreditoDto) {
    if (!dto.facturaClaveAcceso || dto.facturaClaveAcceso.trim().length !== 49) {
      throw new BadRequestException('La clave de acceso de la factura original debe tener exactamente 49 dígitos.');
    }

    // 1. Obtener la factura original de la base de datos
    const facturaDb = await this.sriRepository.obtenerComprobantePorClave(dto.facturaClaveAcceso);
    if (!facturaDb) {
      throw new NotFoundException(`Factura original con clave ${dto.facturaClaveAcceso} no encontrada.`);
    }

    if (facturaDb.estado !== 'AUTORIZADO') {
      throw new BadRequestException(
        `Solo se puede emitir una Nota de Crédito sobre una factura AUTORIZADA por el SRI. Estado actual: ${facturaDb.estado}`,
      );
    }

    // 1.1. Recuperar detalles originales de venta para mapear producto_id real
    let detallesVentaOriginal: Array<{
      producto_id: string;
      codigo_principal: string;
      descripcion: string;
      cantidad: number;
    }> = [];

    if (facturaDb.venta_id) {
      try {
        const client = this.supabaseService.getClientOrThrow();
        const { data, error } = await client
          .from('venta_detalle')
          .select('producto_id, codigo_principal, descripcion, cantidad')
          .eq('venta_id', facturaDb.venta_id);
        if (!error && Array.isArray(data)) {
          detallesVentaOriginal = data;
        }
      } catch (dbErr: any) {
        this.logger.warn(`No se pudieron cargar detalles de venta_detalle para venta ${facturaDb.venta_id}: ${dbErr.message}`);
      }
    }

    // 2. Extraer datos de la factura original desde su XML firmado/generado
    const xmlFactura = facturaDb.xml_firmado || facturaDb.xml_generado;
    if (!xmlFactura) {
      throw new BadRequestException('El comprobante original no contiene XML para vincular la Nota de Crédito.');
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      trimValues: true,
      parseTagValue: false,
    });
    const parsed = parser.parse(xmlFactura);
    const facturaNode = parsed.factura || parsed;
    const infoTrib = facturaNode.infoTributaria || {};
    const infoFact = facturaNode.infoFactura || {};

    const estabMod = String(infoTrib.estab || '001').padStart(3, '0');
    const ptoEmiMod = String(infoTrib.ptoEmi || '001').padStart(3, '0');
    const secuencialMod = String(infoTrib.secuencial || '000000001').padStart(9, '0');
    const numDocModificado = `${estabMod}-${ptoEmiMod}-${secuencialMod}`;
    const fechaEmisionDocSustento = String(infoFact.fechaEmision || '');

    const rawDetalles = Array.isArray(facturaNode.detalles?.detalle)
      ? facturaNode.detalles.detalle
      : facturaNode.detalles?.detalle
        ? [facturaNode.detalles.detalle]
        : [];

    // 3. Determinar los ítems a devolver y validar cantidades mapeando producto_id real
    const itemsDevolucion: Array<{
      productoId: string;
      codigo: string;
      descripcion: string;
      cantidad: number;
      precioUnitario: number;
      descuento: number;
      tarifaIva: number;
      codigoPorcentajeIva: string;
    }> = [];

    if (dto.items && dto.items.length > 0) {
      for (const itemDto of dto.items) {
        const itemOrig = rawDetalles.find(
          (d: any) => String(d.codigoPrincipal) === String(itemDto.codigo) || String(d.codigoInterno) === String(itemDto.codigo),
        );
        if (!itemOrig) {
          throw new BadRequestException(`El ítem ${itemDto.codigo} no existe en la factura original.`);
        }
        const cantOrig = Number(itemOrig.cantidad || 0);
        if (itemDto.cantidad <= 0 || itemDto.cantidad > cantOrig) {
          throw new BadRequestException(
            `Cantidad a devolver inválida para el ítem ${itemDto.codigo}. Cantidad factura: ${cantOrig}, solicitada: ${itemDto.cantidad}`,
          );
        }

        const rawImpuesto = Array.isArray(itemOrig.impuestos?.impuesto)
          ? itemOrig.impuestos.impuesto[0]
          : itemOrig.impuestos?.impuesto;

        const codPrincipal = String(itemOrig.codigoPrincipal || itemOrig.codigoInterno || itemDto.codigo);
        const desc = String(itemOrig.descripcion || '');
        const matchDetalle = detallesVentaOriginal.find(
          (vd) => vd.codigo_principal === codPrincipal || vd.producto_id === codPrincipal || vd.descripcion === desc,
        );
        const realProductoId = matchDetalle ? matchDetalle.producto_id : codPrincipal;

        itemsDevolucion.push({
          productoId: realProductoId,
          codigo: codPrincipal,
          descripcion: desc,
          cantidad: itemDto.cantidad,
          precioUnitario: Number(itemOrig.precioUnitario || 0),
          descuento: Number(itemOrig.descuento || 0) * (itemDto.cantidad / cantOrig),
          tarifaIva: Number(rawImpuesto?.tarifa || 0),
          codigoPorcentajeIva: String(rawImpuesto?.codigoPorcentaje || '0'),
        });
      }
    } else {
      // Devolución total
      for (const itemOrig of rawDetalles) {
        const rawImpuesto = Array.isArray(itemOrig.impuestos?.impuesto)
          ? itemOrig.impuestos.impuesto[0]
          : itemOrig.impuestos?.impuesto;

        const codPrincipal = String(itemOrig.codigoPrincipal || itemOrig.codigoInterno || '');
        const desc = String(itemOrig.descripcion || '');
        const matchDetalle = detallesVentaOriginal.find(
          (vd) => vd.codigo_principal === codPrincipal || vd.producto_id === codPrincipal || vd.descripcion === desc,
        );
        const realProductoId = matchDetalle ? matchDetalle.producto_id : codPrincipal;

        itemsDevolucion.push({
          productoId: realProductoId,
          codigo: codPrincipal,
          descripcion: desc,
          cantidad: Number(itemOrig.cantidad || 0),
          precioUnitario: Number(itemOrig.precioUnitario || 0),
          descuento: Number(itemOrig.descuento || 0),
          tarifaIva: Number(rawImpuesto?.tarifa || 0),
          codigoPorcentajeIva: String(rawImpuesto?.codigoPorcentaje || '0'),
        });
      }
    }

    // 4. Calcular totales tributarios de la Nota de Crédito
    const cartItems: CartItem[] = itemsDevolucion.map((it, idx) => ({
      id: `nc-it-${idx}`,
      codigo: it.codigo,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      descuento: it.descuento,
      tarifaIva: it.tarifaIva,
      codigoPorcentajeIva: it.codigoPorcentajeIva,
    }));
    const totales = calculateInvoiceTotals(cartItems);

    // 5. El reintegro de stock se ejecutará transaccional e idempotentemente
    //    al AUTORIZARSE el comprobante ante el SRI en el SriQueueProcessor (A2).

    // 6. Obtener secuencial atómico para Nota de Crédito (tipoDoc '04')
    const estab = dto.establecimiento || infoTrib.estab || '001';
    const ptoEmi = dto.puntoEmision || infoTrib.ptoEmi || '001';
    const secuencial = await this.sriRepository.obtenerSiguienteSecuencial('04', estab, ptoEmi);

    // 7. Generar Clave de Acceso para la Nota de Crédito (49 dígitos)
    const fechaActual = new Date();
    const ambiente = dto.ambiente || (infoTrib.ambiente as SriEnvironment) || (process.env.SRI_AMBIENTE as SriEnvironment) || '1';
    const ruc = String(infoTrib.ruc || process.env.SRI_RUC_EMISOR || '1790016919001');

    const claveAcceso = this.accessKeyService.generarClaveAcceso({
      fechaEmision: fechaActual,
      tipoComprobante: '04',
      ruc,
      ambiente,
      establecimiento: estab,
      puntoEmision: ptoEmi,
      secuencial,
      tipoEmision: '1',
    });

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fechaEmisionStr = `${pad(fechaActual.getDate())}/${pad(fechaActual.getMonth() + 1)}/${fechaActual.getFullYear()}`;

    // 8. Construir XML de la Nota de Crédito v1.0.0
    const xmlNcData: NotaCreditoXmlData = {
      ambiente,
      tipoEmision: '1',
      razonSocial: String(infoTrib.razonSocial || 'FARMACIA PHARMASTOCK S.A.'),
      nombreComercial: infoTrib.nombreComercial ? String(infoTrib.nombreComercial) : undefined,
      ruc,
      claveAcceso,
      codDoc: '04',
      estab,
      ptoEmi,
      secuencial,
      dirMatriz: String(infoTrib.dirMatriz || 'Av. Amazonas y Colón'),
      dirEstablecimiento: String(infoFact.dirEstablecimiento || infoTrib.dirMatriz || 'Av. Amazonas y Colón'),
      obligadoContabilidad: (infoFact.obligadoContabilidad || 'SI') as 'SI' | 'NO',
      regimenMicroempresas: infoTrib.regimenMicroempresas ? String(infoTrib.regimenMicroempresas) : undefined,
      regimenRimpe: infoTrib.regimenRimpe ? String(infoTrib.regimenRimpe) : undefined,
      agenteRetencion: infoTrib.agenteRetencion ? String(infoTrib.agenteRetencion) : undefined,
      contribuyenteRimpe: infoTrib.contribuyenteRimpe ? String(infoTrib.contribuyenteRimpe) : undefined,
      fechaEmision: fechaEmisionStr,
      comprador: {
        tipoIdentificacion: String(infoFact.tipoIdentificacionComprador || '05'),
        razonSocial: String(infoFact.razonSocialComprador || 'CONSUMIDOR FINAL'),
        identificacion: String(infoFact.identificacionComprador || '9999999999999'),
        direccion: infoFact.direccionComprador ? String(infoFact.direccionComprador) : undefined,
      },
      documentoModificado: {
        codDoc: '01',
        numDoc: numDocModificado,
        fechaEmision: fechaEmisionDocSustento,
        claveAcceso: dto.facturaClaveAcceso,
      },
      motivo: dto.motivo || 'DEVOLUCIÓN DE MERCADERÍA',
      items: itemsDevolucion.map((it) => {
        const itemSinImp = round2(it.cantidad * it.precioUnitario - it.descuento);
        const valorIva = it.tarifaIva > 0 ? round2(itemSinImp * (it.tarifaIva / 100)) : 0;
        return {
          codigoInterno: it.codigo,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          descuento: it.descuento,
          precioTotalSinImpuesto: itemSinImp,
          codigoImpuesto: '2',
          codigoPorcentaje: it.codigoPorcentajeIva,
          tarifa: it.tarifaIva,
          valorIva,
        };
      }),
      totales,
    };

    const xmlGenerado = this.xmlBuilderService.buildNotaCreditoXml(xmlNcData);

    // 9. Firma digital XAdES-BES
    const certPath = process.env.SRI_P12_PATH;
    const certBase64 = process.env.SRI_P12_BASE64;
    const certPassword = dto.certPassword || process.env.SRI_P12_PASSWORD;
    if ((!certPath && !certBase64) || !certPassword) {
      throw new BadRequestException('Certificado digital .p12 (SRI_P12_PATH o SRI_P12_BASE64) o contraseña no configurados.');
    }

    let xmlFirmado: string;
    try {
      xmlFirmado = this.xmlSignerService.firmarNotaCreditoXml(xmlGenerado, {
        p12Path: certPath,
        p12Base64: certBase64,
        p12Password: certPassword,
      });
    } catch (err: any) {
      this.logger.error(`Error firmando Nota de Crédito: ${err.message}`);
      throw new BadRequestException(`Fallo crítico al firmar Nota de Crédito: ${err.message}`);
    }

    // 10. Persistir en comprobantes con tipo '04' y guardar líneas con producto_id real
    const comprobanteGuardado = await this.sriRepository.guardarComprobante({
      tipoComprobante: '04',
      claveAcceso,
      establecimiento: estab,
      puntoEmision: ptoEmi,
      secuencial,
      estado: 'FIRMADO',
      xmlGenerado,
      xmlFirmado,
      ambiente,
      ventaId: facturaDb.venta_id,
    });

    if (this.sriRepository.guardarDetallesNotaCredito) {
      await this.sriRepository.guardarDetallesNotaCredito(
        itemsDevolucion.map((it) => {
          const itemSinImp = round2(it.cantidad * it.precioUnitario - it.descuento);
          const valorIva = it.tarifaIva > 0 ? round2(itemSinImp * (it.tarifaIva / 100)) : 0;
          return {
            comprobanteId: comprobanteGuardado.id,
            productoId: it.productoId,
            codigoPrincipal: it.codigo,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precioUnitario: it.precioUnitario,
            descuento: it.descuento,
            precioTotalSinImpuesto: itemSinImp,
            codigoImpuesto: '2',
            codigoPorcentaje: it.codigoPorcentajeIva,
            tarifa: it.tarifaIva,
            valorIva,
          };
        }),
      );
    }

    // 11. Encolar y despachar en cola asíncrona SRI
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
      secuencial: `${estab}-${ptoEmi}-${secuencial}`,
      documentoModificado: {
        tipo: '01',
        numDoc: numDocModificado,
        claveAcceso: dto.facturaClaveAcceso,
      },
      fechaEmision: fechaEmisionStr,
      totales,
      estado: 'FIRMADO',
      ambiente: ambiente === '1' ? 'PRUEBAS' : 'PRODUCCIÓN',
      mensaje: 'Nota de Crédito emitida y encolada para autorización ante el SRI.',
    };
  }
}
