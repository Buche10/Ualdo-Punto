import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validador genérico contra esquemas XSD oficiales del SRI usando libxml2 compilado a WASM
 */
async function validarXmlContraXsd(
  xmlString: string,
  xsdRelativePath: string,
  tipoComprobanteEsperado?: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const xsdPath = path.resolve(__dirname, xsdRelativePath);

  if (!fs.existsSync(xsdPath)) {
    errors.push(`Esquema XSD no encontrado en: ${xsdPath}`);
    return { valid: false, errors };
  }

  let xsdDoc: any;
  let xmlDoc: any;

  try {
    const { XmlDocument, XsdValidator } = await import('libxml2-wasm');
    const xsdContent = fs.readFileSync(xsdPath, 'utf8');
    xsdDoc = XmlDocument.fromString(xsdContent);
    const validator = XsdValidator.fromDoc(xsdDoc);

    xmlDoc = XmlDocument.fromString(xmlString);
    try {
      validator.validate(xmlDoc);
    } catch (valErr: any) {
      errors.push(`Error de validación XSD: ${valErr?.message || valErr}`);
    }
  } catch (err: any) {
    errors.push(`Error al procesar XSD/XML: ${err?.message || err}`);
  } finally {
    try {
      xsdDoc?.dispose();
    } catch {
      // Ignorar error al liberar memoria
    }
    try {
      xmlDoc?.dispose();
    } catch {
      // Ignorar error al liberar memoria
    }
  }

  // Verificación de clave de acceso del SRI (49 dígitos numéricos)
  const claveMatch = xmlString.match(/<claveAcceso>(\d{49})<\/claveAcceso>/);
  if (!claveMatch) {
    errors.push('La <claveAcceso> debe constar de exactamente 49 dígitos numéricos válidos.');
  } else if (tipoComprobanteEsperado) {
    const tipo = claveMatch[1].substring(8, 10);
    if (tipo !== tipoComprobanteEsperado) {
      errors.push(`El tipo en claveAcceso (${tipo}) no coincide con el comprobante esperado (${tipoComprobanteEsperado}).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida un comprobante XML de Factura contra el esquema XSD oficial del SRI (V2.1.0)
 */
export async function validarFacturaContraXsdOficial(xmlString: string): Promise<ValidationResult> {
  return validarXmlContraXsd(xmlString, '../schemas/factura_V2.1.0.xsd', '01');
}

/**
 * Valida un comprobante XML de Nota de Crédito contra el esquema XSD oficial del SRI (V1.1.0)
 */
export async function validarNotaCreditoContraXsdOficial(xmlString: string): Promise<ValidationResult> {
  return validarXmlContraXsd(xmlString, '../schemas/NotaCredito_V1.1.0.xsd', '04');
}
