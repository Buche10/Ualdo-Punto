import { describe, it, expect } from 'vitest';
import { validarCedula, validarRuc, CustomerSchema } from '../customer.schema';

describe('Validadores de Identificación SRI Ecuador', () => {
  describe('Cédula Ecuatoriana (Módulo 10)', () => {
    it('debe validar una cédula ecuatoriana válida', () => {
      // 1710034065 es un ejemplo clásico de cédula válida de Pichincha
      expect(validarCedula('1710034065')).toBe(true);
    });

    it('debe rechazar una cédula con dígito verificador erróneo', () => {
      expect(validarCedula('1710034066')).toBe(false);
    });

    it('debe rechazar una cédula con provincia inválida', () => {
      expect(validarCedula('9910034065')).toBe(false);
    });

    it('debe rechazar una cédula con longitud distinta a 10 dígitos', () => {
      expect(validarCedula('171003406')).toBe(false);
      expect(validarCedula('17100340655')).toBe(false);
    });
  });

  describe('RUC Ecuatoriano', () => {
    it('debe validar un RUC de persona natural válido (cédula + 001)', () => {
      expect(validarRuc('1710034065001')).toBe(true);
    });

    it('debe rechazar un RUC de persona natural que no termine en 001', () => {
      expect(validarRuc('1710034065002')).toBe(false);
    });

    it('debe validar un RUC de sociedad privada válido (3er dígito 9)', () => {
      // 1790016919001 (Corporación Favorita C.A.)
      expect(validarRuc('1790016919001')).toBe(true);
    });

    it('debe rechazar un RUC de sociedad privada con dígito verificador incorrecto', () => {
      expect(validarRuc('1790016918001')).toBe(false);
    });
  });

  describe('CustomerSchema Zod', () => {
    it('debe aceptar Consumidor Final con 13 nueves', () => {
      const valid = CustomerSchema.safeParse({
        tipoIdentificacion: '07',
        identificacion: '9999999999999',
        razonSocial: 'CONSUMIDOR FINAL',
      });
      expect(valid.success).toBe(true);
    });

    it('debe rechazar Consumidor Final si la identificación no son 13 nueves', () => {
      const invalid = CustomerSchema.safeParse({
        tipoIdentificacion: '07',
        identificacion: '9999999999',
        razonSocial: 'CONSUMIDOR FINAL',
      });
      expect(invalid.success).toBe(false);
    });
  });
});
