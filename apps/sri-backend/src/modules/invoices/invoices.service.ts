import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { AccessKeyService } from '../sri/access-key.service';
import { XmlBuilderService, FacturaXmlData } from '../sri/xml-builder.service';
import { XmlSignerService } from '../sri/xml-signer.service';
import { SriSoapClientService } from '../sri/sri-soap-client.service';
import { RideGeneratorService } from '../sri/ride-generator.service';
import { SriMailerService } from '../sri/sri-mailer.service';
import { calculateInvoiceTotals, CustomerSchema, SriEnvironment } from '@pharmastock/shared';

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
  secuencial: string;      // '000000001'
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
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  // Registro en memoria / cache para comprobantes emitidos
  private comprobantesCache = new Map<string, {
    xmlGenerado: string;
    xmlFirmado: string;
    xmlData: FacturaXmlData;
    estado: string;
    numeroAutorizacion?: string;
    fechaAutorizacion?: string;
    mensajes?: unknown[];
  }>();

  constructor(
    private readonly accessKeyService: AccessKeyService,
    private readonly xmlBuilderService: XmlBuilderService,
    private readonly xmlSignerService: XmlSignerService,
    private readonly soapClient: SriSoapClientService,
    private readonly rideGenerator: RideGeneratorService,
    private readonly mailerService: SriMailerService,
  ) {}

  public async emitirFactura(dto: EmitirFacturaDto) {
    // 1. Validar cliente con Zod
    const clienteValido = CustomerSchema.safeParse(dto.comprador);
    if (!clienteValido.success) {
      throw new BadRequestException(`Datos de cliente inválidos: ${clienteValido.error.issues.map(i => i.message).join(', ')}`);
    }

    // 2. Calcular totales tributarios con el motor puro de farmacia (0% y 15%)
    const totales = calculateInvoiceTotals(dto.items);

    if (dto.comprador.tipoIdentificacion === '07' && totales.excedeLimiteConsumidorFinal) {
      throw new BadRequestException('Para ventas a Consumidor Final superiores a $50.00 USD es obligatorio identificar al cliente con RUC o Cédula (Resolución SRI).');
    }

    // 3. Generar Clave de Acceso (49 dígitos)
    const fechaActual = new Date();
    const ambiente = dto.ambiente || (process.env.SRI_AMBIENTE as SriEnvironment) || '1';

    const claveAcceso = this.accessKeyService.generarClaveAcceso({
      fechaEmision: fechaActual,
      tipoComprobante: '01',
      ruc: dto.emisor.ruc,
      ambiente,
      establecimiento: dto.establecimiento,
      puntoEmision: dto.puntoEmision,
      secuencial: dto.secuencial,
      tipoEmision: '1',
    });

    const d = fechaActual.getDate().toString().padStart(2, '0');
    const m = (fechaActual.getMonth() + 1).toString().padStart(2, '0');
    const y = fechaActual.getFullYear().toString();
    const fechaEmisionStr = `${d}/${m}/${y}`;

    // 4. Construir XML Factura v2.1.0
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
      secuencial: dto.secuencial.padStart(9, '0'),
      dirMatriz: dto.emisor.dirMatriz,
      dirEstablecimiento: dto.emisor.dirEstablecimiento,
      obligadoContabilidad: dto.emisor.obligadoContabilidad,
      regimenRimpe: dto.emisor.regimenRimpe,
      fechaEmision: fechaEmisionStr,
      comprador: dto.comprador,
      items: dto.items.map(item => ({
        codigoPrincipal: item.codigo,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        descuento: item.descuento,
        precioTotalSinImpuesto: item.cantidad * item.precioUnitario - item.descuento,
        codigoImpuesto: '2',
        codigoPorcentaje: item.codigoPorcentajeIva,
        tarifa: item.tarifaIva,
        valorIva: item.tarifaIva > 0 ? (item.cantidad * item.precioUnitario - item.descuento) * (item.tarifaIva / 100) : 0,
      })),
      totales,
      pagos: [{ formaPago: dto.formaPagoCodigo, total: totales.importeTotal }],
    };

    const xmlGenerado = this.xmlBuilderService.buildFacturaXml(xmlData);

    // 5. Firma electrónica (si el p12 está configurado o certificado en memoria)
    let xmlFirmado = xmlGenerado;
    const certPath = process.env.SRI_P12_PATH;
    const certPassword = dto.certPassword || process.env.SRI_P12_PASSWORD;

    if (certPath && certPassword) {
      try {
        xmlFirmado = this.xmlSignerService.firmarFacturaXml(xmlGenerado, {
          p12Path: certPath,
          p12Password: certPassword,
        });
      } catch (err) {
        this.logger.warn(`No se pudo firmar con .p12 físico: ${(err as Error).message}. Se preserva XML pre-firma.`);
      }
    }

    // Guardar en cache para RIDE y descargas
    this.comprobantesCache.set(claveAcceso, {
      xmlGenerado,
      xmlFirmado,
      xmlData,
      estado: 'GENERADO',
    });

    return {
      claveAcceso,
      secuencial: `${dto.establecimiento}-${dto.puntoEmision}-${dto.secuencial.padStart(9, '0')}`,
      fechaEmision: fechaEmisionStr,
      totales,
      estado: 'GENERADO',
      ambiente: ambiente === '1' ? 'PRUEBAS' : 'PRODUCCIÓN',
    };
  }

  public async obtenerRidePdf(claveAcceso: string): Promise<Buffer> {
    const registro = this.comprobantesCache.get(claveAcceso);
    if (!registro) {
      throw new NotFoundException(`Comprobante con clave ${claveAcceso} no encontrado`);
    }

    const { xmlData, numeroAutorizacion, fechaAutorizacion } = registro;

    return await this.rideGenerator.generarRidePdf({
      emisor: {
        razonSocial: xmlData.razonSocial,
        nombreComercial: xmlData.nombreComercial,
        ruc: xmlData.ruc,
        dirMatriz: xmlData.dirMatriz,
        dirEstablecimiento: xmlData.dirEstablecimiento,
        obligadoContabilidad: xmlData.obligadoContabilidad,
        regimenRimpe: xmlData.regimenRimpe,
        ambiente: xmlData.ambiente,
        tipoEmision: xmlData.tipoEmision,
      },
      factura: {
        secuencialCompleto: `${xmlData.estab}-${xmlData.ptoEmi}-${xmlData.secuencial}`,
        claveAcceso: xmlData.claveAcceso,
        numeroAutorizacion: numeroAutorizacion || xmlData.claveAcceso,
        fechaAutorizacion: fechaAutorizacion || xmlData.fechaEmision,
        fechaEmision: xmlData.fechaEmision,
      },
      cliente: xmlData.comprador,
      items: xmlData.items.map(i => ({
        codigo: i.codigoPrincipal,
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        descuento: i.descuento,
        precioTotal: i.precioTotalSinImpuesto,
      })),
      totales: xmlData.totales,
      pagos: xmlData.pagos.map(p => ({
        formaPagoNombre: p.formaPago === '01' ? 'SIN UTILIZACION DEL SISTEMA FINANCIERO' : 'OTROS CON UTILIZACION DEL SF',
        total: p.total,
      })),
    });
  }

  public obtenerXml(claveAcceso: string): string {
    const registro = this.comprobantesCache.get(claveAcceso);
    if (!registro) {
      throw new NotFoundException(`Comprobante con clave ${claveAcceso} no encontrado`);
    }
    return registro.xmlFirmado || registro.xmlGenerado;
  }
}
