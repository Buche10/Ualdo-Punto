import { z } from 'zod';

/**
 * Validador de Cédula Ecuatoriana (Módulo 10)
 */
export function validarCedula(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;

  const provincia = parseInt(cedula.substring(0, 2), 10);
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;

  const tercerDigito = parseInt(cedula.charAt(2), 10);
  if (tercerDigito >= 6) return false;

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let valor = parseInt(cedula.charAt(i), 10) * coeficientes[i];
    if (valor >= 10) valor -= 9;
    suma += valor;
  }

  const digitoVerificadorCalculado = (10 - (suma % 10)) % 10;
  const digitoVerificador = parseInt(cedula.charAt(9), 10);

  return digitoVerificadorCalculado === digitoVerificador;
}

/**
 * Validador de RUC Ecuatoriano (Personas naturales, jurídicas privadas y públicas)
 */
export function validarRuc(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;

  const provincia = parseInt(ruc.substring(0, 2), 10);
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;

  const tercerDigito = parseInt(ruc.charAt(2), 10);

  // 1. RUC de Persona Natural (basado en cédula + 001)
  if (tercerDigito < 6) {
    if (!ruc.endsWith('001')) return false;
    return validarCedula(ruc.substring(0, 10));
  }

  // 2. RUC de Sociedad Privada o Extranjeros sin cédula (3er dígito = 9)
  if (tercerDigito === 9) {
    if (!ruc.substring(10).includes('001')) return false;
    const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      suma += parseInt(ruc.charAt(i), 10) * coeficientes[i];
    }
    const residuo = suma % 11;
    const digitoVerificador = residuo === 0 ? 0 : 11 - residuo;
    return digitoVerificador === parseInt(ruc.charAt(9), 10);
  }

  // 3. RUC de Entidad Pública (3er dígito = 6)
  if (tercerDigito === 6) {
    if (!ruc.substring(9).includes('0001')) return false;
    const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
    let suma = 0;
    for (let i = 0; i < 8; i++) {
      suma += parseInt(ruc.charAt(i), 10) * coeficientes[i];
    }
    const residuo = suma % 11;
    const digitoVerificador = residuo === 0 ? 0 : 11 - residuo;
    return digitoVerificador === parseInt(ruc.charAt(8), 10);
  }

  return false;
}

export const CustomerSchema = z.object({
  id: z.string().optional(),
  tipoIdentificacion: z.enum(['04', '05', '06', '07', '08']),
  identificacion: z.string().min(1).max(20),
  razonSocial: z.string().min(1).max(300),
  direccion: z.string().max(300).optional(),
  telefono: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
}).refine((data) => {
  if (data.tipoIdentificacion === '05') {
    return validarCedula(data.identificacion);
  }
  if (data.tipoIdentificacion === '04') {
    return validarRuc(data.identificacion);
  }
  if (data.tipoIdentificacion === '07') {
    return data.identificacion === '9999999999999';
  }
  return true;
}, {
  message: 'El número de identificación no es válido para el tipo seleccionado',
  path: ['identificacion'],
});

export type Customer = z.infer<typeof CustomerSchema>;
