import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { CASOS_CERTIFICACION_SRI } from './certificacion-casos';
import { validarFacturaContraXsdOficial } from './certificacion-validator';
import { XmlBuilderService, FacturaXmlData } from '../apps/sri-backend/src/modules/sri/xml-builder.service';
import { AccessKeyService } from '../apps/sri-backend/src/modules/sri/access-key.service';
import { XmlSignerService } from '../apps/sri-backend/src/modules/sri/xml-signer.service';
import { SriSoapClientService } from '../apps/sri-backend/src/modules/sri/sri-soap-client.service';
import { calculateInvoiceTotals, round2 } from '@pharmastock/shared';

dotenv.config({ path: path.resolve(__dirname, '../apps/sri-backend/.env') });

async function runCertificacion() {
  console.log('===============================================================');
  console.log('  PHARMASTOCK SRI — CERTIFICACIÓN OFICIAL DE COMPROBANTES XSD   ');
  console.log('===============================================================\n');

  const xmlBuilder = new XmlBuilderService();
  const accessKeyService = new AccessKeyService();
  const xmlSigner = new XmlSignerService();
  const soapClient = new SriSoapClientService();

  const certPath = process.env.SRI_P12_PATH;
  const certPassword = process.env.SRI_P12_PASSWORD;
  const ambiente = (process.env.SRI_AMBIENTE as '1' | '2') || '1';
  const rucEmisor = process.env.SRI_RUC_EMISOR || '1790016919001';

  console.log(`Ambiente:        ${ambiente === '1' ? '1 (PRUEBAS CELCER)' : '2 (PRODUCCIÓN CEL)'}`);
  console.log(`RUC Emisor:      ${rucEmisor}`);
  console.log(`Certificado:     ${certPath ? certPath : '[NO DETECTADO - Modo Validación XSD Real y Estructura]'}\n`);

  const outputDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  let secuencialNum = 1;
  let aprobados = 0;
  let fallidos = 0;

  for (const caso of CASOS_CERTIFICACION_SRI) {
    console.log(`---------------------------------------------------------------`);
    console.log(`[${caso.id}] ${caso.nombre}`);

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
          valorIva: it.tarifaIva > 0 ? round2(base * (it.tarifaIva / 100)) : 0,
        };
      }),
      totales,
      pagos: [{ formaPago: caso.formaPagoCodigo, total: totales.importeTotal }],
    };

    const xmlGenerado = xmlBuilder.buildFacturaXml(xmlData);

    // 1. Validación estricta con libxml2 contra el esquema oficial XSD del SRI
    const validacion = await validarFacturaContraXsdOficial(xmlGenerado);
    if (!validacion.valid) {
      console.error(`❌ [XSD RECHAZO] En ${caso.id}:`);
      validacion.errors.forEach((e) => console.error(`   - ${e}`));
      fallidos++;
      continue;
    }
    console.log(`✓ Validación XSD Oficial SRI (factura_V2.1.0.xsd): APROBADA`);

    // 2. Firma digital si el certificado está provisto
    let xmlFinal = xmlGenerado;
    let firmado = false;
    if (certPath && fs.existsSync(certPath) && certPassword) {
      try {
        xmlFinal = xmlSigner.firmarFacturaXml(xmlGenerado, { p12Path: certPath, p12Password: certPassword });
        firmado = true;
        console.log(`✓ Firma digital XAdES-BES completada.`);
      } catch (err: any) {
        console.warn(`⚠️ Error en firma .p12: ${err.message}`);
      }
    }

    // 3. Transmisión real al Web Service del SRI si está firmado
    let estadoFinalSri = 'PENDIENTE_TRANSMISION';
    if (firmado) {
      console.log(`→ Transmitiendo a Web Service SRI Recepción...`);
      const recepcion = await soapClient.enviarComprobante(xmlFinal, ambiente);
      console.log(`  Respuesta Recepción: ${recepcion.estado}`);

      if (recepcion.estado === 'RECIBIDA') {
        console.log(`→ Consultando Autorización SRI...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const autorizacion = await soapClient.consultarAutorizacion(claveAcceso, ambiente);
        console.log(`  Respuesta Autorización: ${autorizacion.estado}`);
        estadoFinalSri = autorizacion.estado;

        fs.writeFileSync(path.join(outputDir, `${caso.id}_sri_auth.json`), JSON.stringify(autorizacion, null, 2));
      } else {
        estadoFinalSri = recepcion.estado;
        fs.writeFileSync(path.join(outputDir, `${caso.id}_sri_rec.json`), JSON.stringify(recepcion, null, 2));
      }
    }

    // 4. Guardar artefacto XML
    const xmlFile = path.join(outputDir, `${caso.id}_${claveAcceso}.xml`);
    fs.writeFileSync(xmlFile, xmlFinal, 'utf8');
    console.log(`✓ Archivo: ${path.basename(xmlFile)}`);
    console.log(`✓ Totales: Sub0: $${totales.subtotal0} | Sub15: $${totales.subtotal15} | IVA: $${totales.totalIva} | TOTAL: $${totales.importeTotal}`);
    console.log(`✅ [ESTADO] XSD: VÁLIDO | SRI: ${firmado ? estadoFinalSri : 'SIMULADO (Requiere .p12 para envío SOAP)'}\n`);
    aprobados++;
  }

  console.log('===============================================================');
  console.log(`RESUMEN: ${aprobados} Casos XSD Aprobados | ${fallidos} Fallidos`);
  console.log('===============================================================');

  if (fallidos > 0) process.exit(1);
}

runCertificacion().catch((err) => {
  console.error('Error crítico en certificación:', err);
  process.exit(1);
});
