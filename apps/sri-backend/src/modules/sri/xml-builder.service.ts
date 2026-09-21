import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { SriDocType, SriEnvironment, SriEmissionType } from '@pharmastock/shared';

export interface FacturaItemXml {
  codigoPrincipal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  precioTotalSinImpuesto: number;
  codigoImpuesto: string;
  codigoPorcentaje: string;
  tarifa: number;
  valorIva: number;
}

export interface FacturaTotalesXml {
  subtotal0: number;
  subtotal15: number;
  totalSinImpuestos: number;
  totalDescuento: number;
  totalIva: number;
  propina: number;
  importeTotal: number;
  impuestosDetalle: Array<{
    codigo: string;
    codigoPorcentaje: string;
    tarifa: number;
    baseImponible: number;
    valor: number;
  }>;
}

export interface FacturaXmlData {
  ambiente: SriEnvironment;
  tipoEmision: SriEmissionType;
  razonSocial: string;
  nombreComercial?: string;
  ruc: string;
  claveAcceso: string;
  codDoc: SriDocType;
  estab: string;
  ptoEmi: string;
  secuencial: string;
  dirMatriz: string;
  dirEstablecimiento: string;
  contribuyenteEspecial?: string;
  obligadoContabilidad: 'SI' | 'NO';
  regimenRimpe?: string;
  fechaEmision: string; // dd/mm/aaaa
  comprador: {
    tipoIdentificacion: string;
    razonSocial: string;
    identificacion: string;
    direccion?: string;
    email?: string;
    telefono?: string;
  };
  items: FacturaItemXml[];
  totales: FacturaTotalesXml;
  pagos: Array<{
    formaPago: string;
    total: number;
    plazo?: number;
    unidadTiempo?: string;
  }>;
}

@Injectable()
export class XmlBuilderService {
  /**
   * Construye el nodo infoTributaria
   */
  private buildInfoTributaria(data: FacturaXmlData) {
    const info: Record<string, unknown> = {
      ambiente: data.ambiente,
      tipoEmision: data.tipoEmision,
      razonSocial: data.razonSocial,
      ruc: data.ruc,
      claveAcceso: data.claveAcceso,
      codDoc: data.codDoc,
      estab: data.estab,
      ptoEmi: data.ptoEmi,
      secuencial: data.secuencial,
      dirMatriz: data.dirMatriz,
    };

    if (data.nombreComercial) {
      info.nombreComercial = data.nombreComercial;
    }
    if (data.regimenRimpe) {
      info.regimenMicroempresas = data.regimenRimpe;
    }

    return info;
  }

  /**
   * Construye el nodo infoFactura con desglose de impuestos y pagos
   */
  private buildInfoFactura(data: FacturaXmlData) {
    const totalImpuestos = data.totales.impuestosDetalle.map((imp) => ({
      codigo: imp.codigo,
      codigoPorcentaje: imp.codigoPorcentaje,
      baseImponible: imp.baseImponible.toFixed(2),
      valor: imp.valor.toFixed(2),
    }));

    const pagos = data.pagos.map((p) => ({
      formaPago: p.formaPago,
      total: p.total.toFixed(2),
      ...(p.plazo ? { plazo: p.plazo, unidadTiempo: p.unidadTiempo || 'dias' } : {}),
    }));

    return {
      fechaEmision: data.fechaEmision,
      dirEstablecimiento: data.dirEstablecimiento,
      ...(data.contribuyenteEspecial ? { contribuyenteEspecial: data.contribuyenteEspecial } : {}),
      obligadoContabilidad: data.obligadoContabilidad,
      tipoIdentificacionComprador: data.comprador.tipoIdentificacion,
      razonSocialComprador: data.comprador.razonSocial,
      identificacionComprador: data.comprador.identificacion,
      totalSinImpuestos: data.totales.totalSinImpuestos.toFixed(2),
      totalDescuento: data.totales.totalDescuento.toFixed(2),
      totalConImpuestos: { totalImpuesto: totalImpuestos },
      propina: data.totales.propina.toFixed(2),
      importeTotal: data.totales.importeTotal.toFixed(2),
      moneda: 'DOLAR',
      pagos: { pago: pagos },
    };
  }

  /**
   * Construye los detalles de ítems e impuestos por línea
   */
  private buildDetalles(items: FacturaItemXml[]) {
    return {
      detalle: items.map((item) => ({
        codigoPrincipal: item.codigoPrincipal,
        descripcion: item.descripcion,
        cantidad: item.cantidad.toFixed(2),
        precioUnitario: item.precioUnitario.toFixed(2),
        descuento: item.descuento.toFixed(2),
        precioTotalSinImpuesto: item.precioTotalSinImpuesto.toFixed(2),
        impuestos: {
          impuesto: {
            codigo: item.codigoImpuesto,
            codigoPorcentaje: item.codigoPorcentaje,
            tarifa: item.tarifa.toFixed(2),
            baseImponible: item.precioTotalSinImpuesto.toFixed(2),
            valor: item.valorIva.toFixed(2),
          },
        },
      })),
    };
  }

  /**
   * Construye información adicional (email, teléfono, dirección)
   */
  private buildInfoAdicional(data: FacturaXmlData) {
    const campos: Array<{ '@nombre': string; '#': string }> = [];

    if (data.comprador.email) {
      campos.push({ '@nombre': 'Email', '#': data.comprador.email });
    }
    if (data.comprador.telefono) {
      campos.push({ '@nombre': 'Telefono', '#': data.comprador.telefono });
    }
    if (data.comprador.direccion) {
      campos.push({ '@nombre': 'Direccion', '#': data.comprador.direccion });
    }

    return campos.length > 0 ? { campoAdicional: campos } : null;
  }

  /**
   * Genera el XML completo de la Factura v2.1.0 para el SRI
   */
  public buildFacturaXml(data: FacturaXmlData): string {
    const rootObj: Record<string, unknown> = {
      factura: {
        '@id': 'comprobante',
        '@version': '2.1.0',
        infoTributaria: this.buildInfoTributaria(data),
        infoFactura: this.buildInfoFactura(data),
        detalles: this.buildDetalles(data.items),
      },
    };

    const infoAdicional = this.buildInfoAdicional(data);
    if (infoAdicional) {
      (rootObj.factura as Record<string, unknown>).infoAdicional = infoAdicional;
    }

    const doc = create({ version: '1.0', encoding: 'UTF-8' }, rootObj);
    return doc.end({ prettyPrint: true });
  }
}
