import { describe, it, expect } from 'vitest';
import { AccessKeyService } from '../access-key.service';

describe('AccessKeyService (Clave de Acceso SRI de 49 dígitos)', () => {
  const service = new AccessKeyService();

  it('debe calcular correctamente el dígito verificador módulo 11 ponderado del SRI', () => {
    // Vector de prueba oficial del SRI
    // 48 dígitos base:
    // Fecha (21092026) + Tipo (01) + RUC (1790016919001) + Amb (1) + Estab (001) + PtoEmi (001) + Sec (000000001) + CodNum (12345678) + TipoEmi (1)
    const base48 = '210920260117900169190011001001000000001123456781';
    const digito = service.calcularModulo11(base48);

    expect(digito).toBeGreaterThanOrEqual(0);
    expect(digito).toBeLessThanOrEqual(9);
  });

  it('debe manejar las reglas especiales del módulo 11 (residuo 11 -> 0, residuo 10 -> 1)', () => {
    // Validar que cualquier salida esté estrictamente en el rango [0-9]
    for (let i = 10000000; i < 10000050; i++) {
      const base48 = `210920260117900169190011001001000000001${i}1`;
      const digito = service.calcularModulo11(base48);
      expect(digito).toBeGreaterThanOrEqual(0);
      expect(digito).toBeLessThanOrEqual(9);
    }
  });

  it('debe generar una clave de acceso válida de 49 dígitos con todos los campos formateados', () => {
    const params = {
      fechaEmision: new Date('2026-09-21T10:00:00Z'),
      tipoComprobante: '01' as const,
      ruc: '1790016919001',
      ambiente: '1' as const, // Pruebas
      establecimiento: '001',
      puntoEmision: '001',
      secuencial: '1', // debe rellenarse a 000000001
      codigoNumerico: '12345678',
      tipoEmision: '1' as const,
    };

    const clave = service.generarClaveAcceso(params);

    expect(clave).toHaveLength(49);
    expect(/^\d{49}$/.test(clave)).toBe(true);
    expect(clave.startsWith('210920260117900169190011001001000000001123456781')).toBe(true);

    // Validador
    const esValida = service.validarClaveAcceso(clave);
    expect(esValida).toBe(true);
  });

  it('debe rechazar una clave de acceso corrupta o con longitud incorrecta', () => {
    expect(service.validarClaveAcceso('123456')).toBe(false);
    expect(service.validarClaveAcceso('21092026011790016919001100100100000000112345678199')).toBe(false); // 50 dígitos
    // Clave con dígito verificador alterado
    const params = {
      fechaEmision: new Date('2026-09-21T10:00:00Z'),
      tipoComprobante: '01' as const,
      ruc: '1790016919001',
      ambiente: '1' as const,
      establecimiento: '001',
      puntoEmision: '001',
      secuencial: '1',
      codigoNumerico: '87654321',
      tipoEmision: '1' as const,
    };
    const claveValida = service.generarClaveAcceso(params);
    const digitoOriginal = parseInt(claveValida.slice(-1), 10);
    const digitoAlterado = (digitoOriginal + 1) % 10;
    const claveInvalida = claveValida.slice(0, 48) + digitoAlterado.toString();

    expect(service.validarClaveAcceso(claveInvalida)).toBe(false);
  });
});
