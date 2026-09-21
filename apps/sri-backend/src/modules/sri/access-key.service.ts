import { Injectable } from '@nestjs/common';
import { SriDocType, SriEnvironment, SriEmissionType } from '@pharmastock/shared';

export interface GenerarClaveAccesoParams {
  fechaEmision: Date;
  tipoComprobante: SriDocType;
  ruc: string;
  ambiente: SriEnvironment;
  establecimiento: string;
  puntoEmision: string;
  secuencial: string | number;
  codigoNumerico?: string;
  tipoEmision?: SriEmissionType;
}

@Injectable()
export class AccessKeyService {
  /**
   * Genera un código numérico aleatorio de 8 dígitos si no se provee uno
   */
  public generarCodigoNumerico(): string {
    const min = 10000000;
    const max = 99999999;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Formatea la fecha a ddmmaaaa (8 dígitos)
   */
  public formatearFecha(fecha: Date): string {
    const d = fecha.getDate().toString().padStart(2, '0');
    const m = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const y = fecha.getFullYear().toString();
    return `${d}${m}${y}`;
  }

  /**
   * Calcula el dígito verificador mediante el algoritmo Módulo 11 oficial del SRI
   * Ponderación [7, 6, 5, 4, 3, 2] de derecha a izquierda
   */
  public calcularModulo11(digitos48: string): number {
    let factor = 2;
    let suma = 0;

    for (let i = digitos48.length - 1; i >= 0; i--) {
      suma += parseInt(digitos48.charAt(i), 10) * factor;
      factor = factor === 7 ? 2 : factor + 1;
    }

    const residuo = suma % 11;
    const digito = 11 - residuo;

    if (digito === 11) return 0;
    if (digito === 10) return 1;
    return digito;
  }

  /**
   * Genera la Clave de Acceso de 49 dígitos para el comprobante
   */
  public generarClaveAcceso(params: GenerarClaveAccesoParams): string {
    const fecha = this.formatearFecha(params.fechaEmision);
    const tipo = params.tipoComprobante.padStart(2, '0');
    const ruc = params.ruc.padStart(13, '0');
    const amb = params.ambiente;
    const serie = `${params.establecimiento.padStart(3, '0')}${params.puntoEmision.padStart(3, '0')}`;
    const sec = params.secuencial.toString().padStart(9, '0');
    const codNum = (params.codigoNumerico || this.generarCodigoNumerico()).padStart(8, '0');
    const tipoEmi = params.tipoEmision || '1';

    const base48 = `${fecha}${tipo}${ruc}${amb}${serie}${sec}${codNum}${tipoEmi}`;
    const dv = this.calcularModulo11(base48);

    return `${base48}${dv}`;
  }

  /**
   * Valida la longitud y la integridad del dígito verificador de una clave de acceso
   */
  public validarClaveAcceso(clave: string): boolean {
    if (!/^\d{49}$/.test(clave)) return false;
    const base48 = clave.slice(0, 48);
    const dvEsperado = parseInt(clave.slice(48), 10);
    const dvCalculado = this.calcularModulo11(base48);
    return dvEsperado === dvCalculado;
  }
}
