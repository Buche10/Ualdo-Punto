import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SriComprobanteRepository } from '../sri-comprobante.repository';
import { InternalServerErrorException } from '@nestjs/common';

describe('SriComprobanteRepository (Persistencia Fail-Fast y Sin Fallbacks Silenciosos)', () => {
  let repository: SriComprobanteRepository;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: vi.fn(),
      withTransaction: vi.fn(),
      isAvailable: vi.fn().mockReturnValue(true),
    };

    repository = new SriComprobanteRepository(mockDatabaseService);
  });

  describe('obtenerSiguienteSecuencial', () => {
    it('debe retornar el secuencial formateado a 9 digitos si la consulta tiene exito', async () => {
      mockDatabaseService.query.mockResolvedValueOnce([{ sec: '123' }]);

      const sec = await repository.obtenerSiguienteSecuencial('01', '001', '001');
      expect(sec).toBe('000000123');
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT public.obtener_siguiente_secuencial'),
        ['01', '001', '001'],
      );
    });

    it('debe lanzar InternalServerErrorException si la funcion de BD falla (NUNCA fabricar secuencial)', async () => {
      mockDatabaseService.query.mockRejectedValueOnce(new Error('DB connection failure'));

      await expect(
        repository.obtenerSiguienteSecuencial('01', '001', '001'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('guardarComprobante', () => {
    it('debe retornar el id generado si el insert en la base de datos tiene exito', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({ rows: [{ id: 'uuid-comprobante-1' }] }),
      };
      mockDatabaseService.withTransaction.mockImplementation(async (callback: any) => {
        return callback(mockClient);
      });

      const result = await repository.guardarComprobante({
        claveAcceso: '2209202601179001691900110010010000000011234567818',
        establecimiento: '001',
        puntoEmision: '001',
        secuencial: '000000001',
        estado: 'FIRMADO',
        xmlGenerado: '<xml/>',
        xmlFirmado: '<xml-firmado/>',
      });

      expect(result.id).toBe('uuid-comprobante-1');
    });

    it('debe lanzar InternalServerErrorException si la insercion en base de datos falla', async () => {
      mockDatabaseService.withTransaction.mockRejectedValueOnce(
        new Error('violacion de clave o tabla inaccesible'),
      );

      await expect(
        repository.guardarComprobante({
          claveAcceso: '2209202601179001691900110010010000000011234567818',
          establecimiento: '001',
          puntoEmision: '001',
          secuencial: '000000001',
          estado: 'FIRMADO',
          xmlGenerado: '<xml/>',
          xmlFirmado: '<xml-firmado/>',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('crearSriJob', () => {
    it('debe lanzar InternalServerErrorException si la insercion en sri_jobs falla', async () => {
      mockDatabaseService.query.mockRejectedValueOnce(new Error('sri_jobs error'));

      await expect(repository.crearSriJob('comp-uuid-1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('obtenerComprobantePorClave', () => {
    it('debe retornar null cuando no se encuentra el registro (sin error de BD)', async () => {
      mockDatabaseService.query.mockResolvedValueOnce([]);

      const comp = await repository.obtenerComprobantePorClave('clave-inexistente');
      expect(comp).toBeNull();
    });

    it('debe lanzar InternalServerErrorException cuando hay un error real de BD', async () => {
      mockDatabaseService.query.mockRejectedValueOnce(new Error('timeout en DB'));

      await expect(repository.obtenerComprobantePorClave('clave-inexistente')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
