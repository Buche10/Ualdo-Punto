export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validarFacturaXsdRules(xmlString: string): ValidationResult {
  const errors: string[] = [];

  if (!xmlString.includes('<factura') || !xmlString.includes('version="2.1.0"')) {
    errors.push('El elemento raíz debe ser <factura id="comprobante" version="2.1.0">');
  }

  // 1. Validar orden de bloques de primer nivel
  const idxInfoTributaria = xmlString.indexOf('<infoTributaria>');
  const idxInfoFactura = xmlString.indexOf('<infoFactura>');
  const idxDetalles = xmlString.indexOf('<detalles>');
  const idxInfoAdicional = xmlString.indexOf('<infoAdicional>');

  if (idxInfoTributaria === -1 || idxInfoFactura === -1 || idxDetalles === -1) {
    errors.push('Faltan bloques obligatorios: <infoTributaria>, <infoFactura> o <detalles>');
  }

  if (idxInfoTributaria > idxInfoFactura) {
    errors.push('XSD Violación: <infoTributaria> debe preceder a <infoFactura>');
  }
  if (idxInfoFactura > idxDetalles) {
    errors.push('XSD Violación: <infoFactura> debe preceder a <detalles>');
  }
  if (idxInfoAdicional !== -1 && idxDetalles > idxInfoAdicional) {
    errors.push('XSD Violación: <detalles> debe preceder a <infoAdicional>');
  }

  // 2. Validar Clave de Acceso (49 dígitos numéricos)
  const claveMatch = xmlString.match(/<claveAcceso>(\d{49})<\/claveAcceso>/);
  if (!claveMatch) {
    errors.push('La <claveAcceso> no existe o no tiene exactamente 49 dígitos numéricos.');
  }

  // 3. Validar orden en infoTributaria
  const ordenInfoTrib = ['ambiente', 'tipoEmision', 'razonSocial', 'ruc', 'claveAcceso', 'codDoc', 'estab', 'ptoEmi', 'secuencial', 'dirMatriz'];
  let lastPos = 0;
  for (const tag of ordenInfoTrib) {
    const pos = xmlString.indexOf(`<${tag}>`);
    if (pos === -1) {
      errors.push(`Falta elemento obligatorio <${tag}> en <infoTributaria>`);
    } else if (pos < lastPos) {
      errors.push(`XSD Violación de secuencia en <infoTributaria>: <${tag}> aparece fuera de orden.`);
    }
    lastPos = Math.max(lastPos, pos);
  }

  // 4. Validar formato decimal de 2 decimales en totales
  const campos2Dec = ['totalSinImpuestos', 'totalDescuento', 'importeTotal'];
  for (const campo of campos2Dec) {
    const regex = new RegExp(`<${campo}>(\\d+\\.\\d{2})<\\/${campo}>`);
    if (!regex.test(xmlString)) {
      errors.push(`El campo <${campo}> debe tener formato decimal de 2 dígitos (ej. 12.34).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
