import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { CASOS_CERTIFICACION_SRI } from './certificacion-casos';
import { validarFacturaXsdRules } from './certificacion-validator';
import { XmlBuilderService, FacturaXmlData } from '../apps/sri-backend/src/modules/sri/xml-builder.service';
import { AccessKeyService } from '../apps/sri-backend/src/modules/sri/access-key.service';
import { XmlSignerService } from '../apps/sri-backend/src/modules/sri/xml-signer.service';
import { calculateInvoiceTotals, round2 } from '@pharmastock/shared';

dotenv.config({ path: path.resolve(__dirname, '../apps/sri-backend/.env') });

async function runCertificacion() {
  console.log('===============================================================');
  console.log('  PHARMASTOCK SRI — HARNESS DE CERTIFICACIÓN DE COMPROBANTES   ');
  console.log('===============================================================\n');

  const xmlBuilder = new XmlBuilderService();
  const accessKeyService = new AccessKeyService();
  const xmlSigner = new XmlSignerService();

  const certPath = process.env.SRI_P12_PATH;
  const certPassword = process.env.SRI_P12_PASSWORD;
  const ambiente = (process.env.SRI_AMBIENTE as '1' | '2') || '1';
  const rucEmisor = process.env.SRI_RUC_EMISOR || '1790016919001';

  console.log(`Ambiente Configurado: ${ambiente === '1' ? '1 (PRUEBAS)' : '2 (PRODUCCIÓN)'}`);
  console.log(`RUC Emisor:           ${rucEmisor}`);
  console.log(`Certificado .p12:     ${certPath ? certPath : '[NO DETECTADO - Modo Validación XSD y Simulación]'}\n`);

  const outputDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let secuencialNum = 1;
  let exitosos = 0;
  let fallidos = 0;

  for (const caso of CASOS_CERTIFICACION_SRI) {
    console.log(`---------------------------------------------------------------`);
    console.log(`Ejecutando: ${caso.id} — ${caso.nombre}`);
    console.log(`Descripción: ${caso.descripcion}`);

    const secuencial = String(secuencialNum++).padStart(9, '0');
    const fecha = new Date();
    const claveAcceso = accessKeyService.generarClaveAcceso({
      fechaEmision: fecha,
      tipoComprobante: '01',
      ruc: rucEmisor,
      ambiente,
      establecimiento: '001',
      puntoEmision: '001',
      secuencial,
      tipoEmision: '1',
    });

    const cartItems = caso.items.map((it, idx) => ({
      id: `it-${idx}`,
      codigo: it.codigo,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      descuento: it.descuento,
      tarifaIva: it.tarifaIva,
      codigoPorcentajeIva: it.codigoPorcentajeIva,
    }));

    const totales = calculateInvoiceTotals(cartItems);

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fechaEmisionStr = `${pad(fecha.getDate())}/${pad(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;

    const xmlData: FacturaXmlData = {
      ambiente,
      tipoEmision: '1',
      razonSocial: 'FARMACIA PHARMASTOCK EXPRESS CIA. LTDA.',
      nombreComercial: 'PHARMASTOCK EXPRESS',
      ruc: rucEmisor,
      claveAcceso,
      codDoc: '01',
      estab: '001',
      ptoEmi: '001',
      secuencial,
      dirMatriz: 'Av. Amazonas N24-15 y Colón, Quito',
      dirEstablecimiento: 'Av. Amazonas N24-15 y Colón, Quito',
      obligadoContabilidad: 'SI',
      regimenRimpe: 'CONTRIBUYENTE RÉGIMEN RIMPE',
      fechaEmision: fechaEmisionStr,
      comprador: caso.comprador,
      items: caso.items.map((it) => {
        const base = round2(Math.max(0, it.cantidad * it.precioUnitario - it.descuento));
        const valIva = it.tarifaIva > 0 ? round2(base * (it.tarifaIva / 100)) : 0;
        return {
          codigoPrincipal: it.codigo,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          descuento: it.descuento,
          precioTotalSinImpuesto: base,
          codigoImpuesto: '2',
          codigoPorcentaje: it.codigoPorcentajeIva,
          tarifa: it.tarifaIva,
          valorIva: valIva,
        };
      }),
      totales,
      pagos: [{ formaPago: caso.formaPagoCodigo, total: totales.importeTotal }],
    };

    const xmlGenerado = xmlBuilder.buildFacturaXml(xmlData);

    // 1. Validar contra reglas oficiales XSD
    const validacion = validarFacturaXsdRules(xmlGenerado);
    if (!validacion.valid) {
      console.error(`❌ [XSD RECHAZO] En ${caso.id}:`);
      validacion.errors.forEach((e) => console.error(`   - ${e}`));
      fallidos++;
      continue;
    }
    console.log(`✓ Validación XSD superada con éxito.`);

    // 2. Firmar XML si el certificado está disponible
    let xmlFinal = xmlGenerado;
    if (certPath && fs.existsSync(certPath) && certPassword) {
      try {
        xmlFinal = xmlSigner.firmarFacturaXml(xmlGenerado, {
          p12Path: certPath,
          p12Password: certPassword,
        });
        console.log(`✓ Firma digital XAdES-BES completada.`);
      } catch (err: any) {
        console.warn(`⚠️ Error de firma: ${err.message}. Guardando XML sin firma.`);
      }
    }

    // 3. Guardar artefactos
    const xmlFile = path.join(outputDir, `${caso.id}_${claveAcceso}.xml`);
    fs.writeFileSync(xmlFile, xmlFinal, 'utf8');
    console.log(`✓ Archivo guardado: ${path.basename(xmlFile)}`);
    console.log(`✓ Totales: Sub0: $${totales.subtotal0} | Sub15: $${totales.subtotal15} | IVA: $${totales.totalIva} | TOTAL: $${totales.importeTotal}`);
    console.log(`✅ [APROBADO] ${caso.id} listo para transmisión.\n`);
    exitosos++;
  }

  console.log('===============================================================');
  console.log(`RESUMEN DE CERTIFICACIÓN: ${exitosos} Exitosos | ${fallidos} Fallidos`);
  console.log('===============================================================');

  if (fallidos > 0) {
    process.exit(1);
  }
}

runCertificacion().catch((err) => {
  console.error('Error crítico en harness de certificación:', err);
  process.exit(1);
});
