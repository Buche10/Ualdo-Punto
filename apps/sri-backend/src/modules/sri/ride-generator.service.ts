import { Injectable } from '@nestjs/common';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinterModule = require('pdfmake');
const PdfPrinter: any =
  typeof PdfPrinterModule === 'function'
    ? PdfPrinterModule
    : (PdfPrinterModule.default || PdfPrinterModule);

export interface RideFacturaData {
  emisor: {
    razonSocial: string;
    nombreComercial?: string;
    ruc: string;
    dirMatriz: string;
    dirEstablecimiento: string;
    obligadoContabilidad: string;
    regimenRimpe?: string;
    ambiente: string;
    tipoEmision: string;
  };
  factura: {
    secuencialCompleto: string;
    claveAcceso: string;
    numeroAutorizacion: string;
    fechaAutorizacion: string;
    fechaEmision: string;
  };
  cliente: {
    razonSocial: string;
    identificacion: string;
    tipoIdentificacion: string;
    direccion?: string;
    telefono?: string;
    email?: string;
  };
  items: Array<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    precioTotal: number;
  }>;
  totales: {
    subtotal0: number;
    subtotal15: number;
    totalSinImpuestos: number;
    totalDescuento: number;
    totalIva: number;
    propina: number;
    importeTotal: number;
  };
  pagos: Array<{
    formaPagoNombre: string;
    total: number;
  }>;
}

@Injectable()
export class RideGeneratorService {
  private printer: InstanceType<typeof PdfPrinter>;

  constructor() {
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };
    this.printer = new PdfPrinter(fonts);
  }

  /**
   * Genera el documento PDF del RIDE en un Buffer
   */
  public async generarRidePdf(data: RideFacturaData): Promise<Buffer> {
    const docDefinition = this.buildDocDefinition(data);
    const pdfDoc = this.printer.createPdfKitDocument(docDefinition);

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', (err: Error) => reject(err));
      pdfDoc.end();
    });
  }

  /**
   * Construye la definición del documento PDF para pdfmake
   */
  private buildDocDefinition(data: RideFacturaData): TDocumentDefinitions {
    return {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 20],
      defaultStyle: { font: 'Helvetica', fontSize: 8 },
      content: [
        this.buildHeader(data) as any,
        { text: '\n' },
        this.buildClientInfo(data) as any,
        { text: '\n' },
        this.buildItemsTable(data) as any,
        { text: '\n' },
        this.buildTotalsAndPayments(data) as any,
      ],
      styles: {
        headerTitle: { fontSize: 10, bold: true },
        sectionTitle: { fontSize: 8, bold: true },
        tableHeader: { bold: true, fillColor: '#eeeeee' },
      },
    };
  }

  private buildHeader(data: RideFacturaData) {
    const amb = data.emisor.ambiente === '1' ? 'PRUEBAS' : 'PRODUCCIÓN';
    return {
      columns: [
        {
          width: '50%',
          stack: [
            { text: data.emisor.razonSocial, style: 'headerTitle' },
            data.emisor.nombreComercial ? { text: data.emisor.nombreComercial, bold: true } : {},
            { text: `Matriz: ${data.emisor.dirMatriz}` },
            { text: `Sucursal: ${data.emisor.dirEstablecimiento}` },
            { text: `Obligado a llevar contabilidad: ${data.emisor.obligadoContabilidad}` },
            data.emisor.regimenRimpe ? { text: data.emisor.regimenRimpe, bold: true } : {},
          ],
        },
        {
          width: '50%',
          stack: [
            { text: `R.U.C.: ${data.emisor.ruc}`, style: 'headerTitle' },
            { text: 'FACTURA', style: 'headerTitle', color: '#1e3a8a' },
            { text: `No. ${data.factura.secuencialCompleto}`, bold: true },
            { text: `NÚMERO DE AUTORIZACIÓN:` },
            { text: data.factura.numeroAutorizacion, fontSize: 7 },
            { text: `FECHA Y HORA DE AUTORIZACIÓN: ${data.factura.fechaAutorizacion}` },
            { text: `AMBIENTE: ${amb}` },
            { text: 'EMISIÓN: NORMAL' },
            { text: 'CLAVE DE ACCESO:' },
            { text: data.factura.claveAcceso, fontSize: 7, bold: true },
          ],
        },
      ],
    };
  }

  private buildClientInfo(data: RideFacturaData) {
    return {
      table: {
        widths: ['100%'],
        body: [
          [
            {
              stack: [
                { text: `Razón Social / Nombres: ${data.cliente.razonSocial}`, bold: true },
                { text: `Identificación: ${data.cliente.identificacion}      Fecha Emisión: ${data.factura.fechaEmision}` },
                { text: `Dirección: ${data.cliente.direccion || 'S/N'}      Email: ${data.cliente.email || 'S/N'}` },
              ],
            },
          ],
        ],
      },
      layout: 'box',
    };
  }

  private buildItemsTable(data: RideFacturaData) {
    const rows = data.items.map((i) => [
      i.codigo,
      i.cantidad.toFixed(2),
      i.descripcion,
      `$${i.precioUnitario.toFixed(2)}`,
      `$${i.descuento.toFixed(2)}`,
      `$${i.precioTotal.toFixed(2)}`,
    ]);

    return {
      table: {
        headerRows: 1,
        widths: ['15%', '10%', '45%', '10%', '10%', '10%'],
        body: [
          [
            { text: 'Cod.', style: 'tableHeader' },
            { text: 'Cant.', style: 'tableHeader' },
            { text: 'Descripción', style: 'tableHeader' },
            { text: 'P. Unit', style: 'tableHeader' },
            { text: 'Desc.', style: 'tableHeader' },
            { text: 'Total', style: 'tableHeader' },
          ],
          ...rows,
        ],
      },
    };
  }

  private buildTotalsAndPayments(data: RideFacturaData) {
    return {
      columns: [
        {
          width: '55%',
          stack: [
            { text: 'Formas de Pago:', bold: true },
            ...data.pagos.map((p) => ({ text: `${p.formaPagoNombre}: $${p.total.toFixed(2)}` })),
          ],
        },
        {
          width: '45%',
          table: {
            widths: ['60%', '40%'],
            body: [
              ['SUBTOTAL 15%:', `$${data.totales.subtotal15.toFixed(2)}`],
              ['SUBTOTAL 0%:', `$${data.totales.subtotal0.toFixed(2)}`],
              ['SUBTOTAL SIN IMPUESTOS:', `$${data.totales.totalSinImpuestos.toFixed(2)}`],
              ['TOTAL DESCUENTO:', `$${data.totales.totalDescuento.toFixed(2)}`],
              ['IVA 15%:', `$${data.totales.totalIva.toFixed(2)}`],
              [{ text: 'VALOR TOTAL:', bold: true }, { text: `$${data.totales.importeTotal.toFixed(2)}`, bold: true }],
            ],
          },
        },
      ],
    };
  }
}
