import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida un comprobante XML de Factura contra el esquema XSD oficial del SRI
 * utilizando libxml2 compilado a WebAssembly (ESM dynamic load)
 */
export async function validarFacturaContraXsdOficial(xmlString: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const xsdPath = path.resolve(__dirname, '../schemas/factura_V2.1.0.xsd');

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
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
