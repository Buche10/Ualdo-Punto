import { XMLParser } from 'fast-xml-parser';
import { round2, SriEnvironment } from '@pharmastock/shared';
import { RideFacturaData } from '../sri/ride-generator.service';

/**
 * Reconstruye la estructura RideFacturaData a partir del XML almacenado
 */
export function parseXmlToRideData(xml: string, numAut?: string, fechaAut?: string): RideFacturaData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    trimValues: true,
    parseTagValue: false,
  });
  const parsed = parser.parse(xml);
  const factura = parsed.factura || parsed;
  const tributaria = factura.infoTributaria || {};
  const infoFactura = factura.infoFactura || {};

  const detallesList = Array.isArray(factura.detalles?.detalle)
    ? factura.detalles.detalle
    : factura.detalles?.detalle
      ? [factura.detalles.detalle]
      : [];

  const pagosList = Array.isArray(infoFactura.pagos?.pago)
    ? infoFactura.pagos.pago
    : infoFactura.pagos?.pago
      ? [infoFactura.pagos.pago]
      : [];

  return {
    emisor: {
      razonSocial: String(tributaria.razonSocial || ''),
      nombreComercial: tributaria.nombreComercial ? String(tributaria.nombreComercial) : undefined,
      ruc: String(tributaria.ruc || ''),
      dirMatriz: String(tributaria.dirMatriz || ''),
      dirEstablecimiento: String(infoFactura.dirEstablecimiento || tributaria.dirMatriz || ''),
      obligadoContabilidad: (infoFactura.obligadoContabilidad || 'NO') as 'SI' | 'NO',
      regimenRimpe: tributaria.contribuyenteRimpe ? String(tributaria.contribuyenteRimpe) : undefined,
      ambiente: String(tributaria.ambiente || '1') as SriEnvironment,
      tipoEmision: '1',
    },
    factura: {
      secuencialCompleto: `${tributaria.estab || '001'}-${tributaria.ptoEmi || '001'}-${tributaria.secuencial || '000000001'}`,
      claveAcceso: String(tributaria.claveAcceso || ''),
      numeroAutorizacion: numAut || String(tributaria.claveAcceso || ''),
      fechaAutorizacion: fechaAut || String(infoFactura.fechaEmision || ''),
      fechaEmision: String(infoFactura.fechaEmision || ''),
    },
    cliente: {
      tipoIdentificacion: String(infoFactura.tipoIdentificacionComprador || '07'),
      razonSocial: String(infoFactura.razonSocialComprador || 'CONSUMIDOR FINAL'),
      identificacion: String(infoFactura.identificacionComprador || '9999999999999'),
      direccion: infoFactura.direccionComprador ? String(infoFactura.direccionComprador) : undefined,
    },
    items: detallesList.map((d: any) => ({
      codigo: String(d.codigoPrincipal || ''),
      descripcion: String(d.descripcion || ''),
      cantidad: Number(d.cantidad || 0),
      precioUnitario: Number(d.precioUnitario || 0),
      descuento: Number(d.descuento || 0),
      precioTotal: Number(d.precioTotalSinImpuesto || 0),
    })),
    totales: {
      subtotal0: Number(infoFactura.totalSinImpuestos || 0),
      subtotal15: 0,
      totalSinImpuestos: Number(infoFactura.totalSinImpuestos || 0),
      totalDescuento: Number(infoFactura.totalDescuento || 0),
      totalIva: round2(Number(infoFactura.importeTotal || 0) - Number(infoFactura.totalSinImpuestos || 0)),
      propina: Number(infoFactura.propina || 0),
      importeTotal: Number(infoFactura.importeTotal || 0),
    },
    pagos: pagosList.map((p: any) => ({
      formaPagoNombre:
        String(p.formaPago) === '01'
          ? 'SIN UTILIZACION DEL SISTEMA FINANCIERO'
          : 'OTROS CON UTILIZACION DEL SF',
      total: Number(p.total || 0),
    })),
  };
}
