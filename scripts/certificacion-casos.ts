export interface CasoCertificacion {
  id: string;
  nombre: string;
  descripcion: string;
  comprador: {
    tipoIdentificacion: '04' | '05' | '06' | '07' | '08';
    identificacion: string;
    razonSocial: string;
    direccion?: string;
    email?: string;
    telefono?: string;
  };
  items: Array<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    tarifaIva: number;
    codigoPorcentajeIva: string;
  }>;
  formaPagoCodigo: string;
  resultadoEsperado: {
    estado: 'AUTORIZADO' | 'RECIBIDA';
    subtotal0: number;
    subtotal15: number;
    totalIva: number;
    importeTotal: number;
  };
}

export const CASOS_CERTIFICACION_SRI: CasoCertificacion[] = [
  {
    id: 'CASO-01',
    nombre: 'Factura a Consumidor Final (< $50.00)',
    descripcion: 'Venta minorista de mostrador con valor inferior al límite legal de $50 USD.',
    comprador: {
      tipoIdentificacion: '07',
      identificacion: '9999999999999',
      razonSocial: 'CONSUMIDOR FINAL',
      direccion: 'Quito, Ecuador',
      email: 'consumidorfinal@pharmastock.ec',
    },
    items: [
      {
        codigo: 'MED-01',
        descripcion: 'Paracetamol 500mg Caja x 20',
        cantidad: 2,
        precioUnitario: 2.50,
        descuento: 0,
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
      {
        codigo: 'INS-01',
        descripcion: 'Alcohol antiséptico 70% 500ml',
        cantidad: 1,
        precioUnitario: 3.00,
        descuento: 0,
        tarifaIva: 15,
        codigoPorcentajeIva: '4',
      },
    ],
    formaPagoCodigo: '01', // Efectivo
    resultadoEsperado: {
      estado: 'AUTORIZADO',
      subtotal0: 5.00,
      subtotal15: 3.00,
      totalIva: 0.45,
      importeTotal: 8.45,
    },
  },
  {
    id: 'CASO-02',
    nombre: 'Factura con Cédula (Medicamentos Tarifa 0%)',
    descripcion: 'Venta con cédula ecuatoriana válida, solo medicamentos de uso humano gravados con 0% IVA.',
    comprador: {
      tipoIdentificacion: '05',
      identificacion: '1710034065',
      razonSocial: 'JUAN PEREZ GONZALEZ',
      direccion: 'Av. 10 de Agosto N12-34, Quito',
      email: 'juan.perez@gmail.com',
      telefono: '0991234567',
    },
    items: [
      {
        codigo: 'MED-02',
        descripcion: 'Amoxicilina 500mg Cápsulas',
        cantidad: 3,
        precioUnitario: 4.20,
        descuento: 0,
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
      {
        codigo: 'MED-03',
        descripcion: 'Omeprazol 20mg Cápsulas',
        cantidad: 2,
        precioUnitario: 3.10,
        descuento: 0,
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
    ],
    formaPagoCodigo: '16', // Tarjeta de débito
    resultadoEsperado: {
      estado: 'AUTORIZADO',
      subtotal0: 18.80,
      subtotal15: 0.00,
      totalIva: 0.00,
      importeTotal: 18.80,
    },
  },
  {
    id: 'CASO-03',
    nombre: 'Factura a Sociedad con RUC (Bienes Tarifa 15%)',
    descripcion: 'Venta a corporación con RUC válido 13 dígitos, bienes de cuidado personal gravados al 15%.',
    comprador: {
      tipoIdentificacion: '04',
      identificacion: '1790016919001',
      razonSocial: 'CORPORACION MEDICA DEL ECUADOR S.A.',
      direccion: 'Av. Shyris N34-12, Quito',
      email: 'facturacion@corpmedica.ec',
      telefono: '022987654',
    },
    items: [
      {
        codigo: 'COS-01',
        descripcion: 'Bloqueador Solar FPS 50+ 120ml',
        cantidad: 2,
        precioUnitario: 15.00,
        descuento: 0,
        tarifaIva: 15,
        codigoPorcentajeIva: '4',
      },
    ],
    formaPagoCodigo: '20', // Transferencia
    resultadoEsperado: {
      estado: 'AUTORIZADO',
      subtotal0: 0.00,
      subtotal15: 30.00,
      totalIva: 4.50,
      importeTotal: 34.50,
    },
  },
  {
    id: 'CASO-04',
    nombre: 'Factura Mixta con Descuento por Línea',
    descripcion: 'Venta combinada con descuento comercial en línea de producto al 15% y medicina al 0%.',
    comprador: {
      tipoIdentificacion: '05',
      identificacion: '1710034065',
      razonSocial: 'MARIA CARMEN LOPEZ',
      direccion: 'Cumbayá, Quito',
      email: 'mlopez@outlook.com',
    },
    items: [
      {
        codigo: 'MED-04',
        descripcion: 'Ibuprofeno 600mg Caja x 20',
        cantidad: 4,
        precioUnitario: 3.50, // 14.00 bruto
        descuento: 2.00,       // 12.00 neto
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
      {
        codigo: 'INS-02',
        descripcion: 'Termómetro Digital Infrarrojo',
        cantidad: 1,
        precioUnitario: 25.00, // 25.00 bruto
        descuento: 5.00,       // 20.00 neto
        tarifaIva: 15,
        codigoPorcentajeIva: '4',
      },
    ],
    formaPagoCodigo: '19', // Tarjeta de crédito
    resultadoEsperado: {
      estado: 'AUTORIZADO',
      subtotal0: 12.00,
      subtotal15: 20.00,
      totalIva: 3.00, // 20.00 * 0.15
      importeTotal: 35.00,
    },
  },
];
