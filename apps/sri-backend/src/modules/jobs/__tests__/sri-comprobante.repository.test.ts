import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SriComprobanteRepository } from '../sri-comprobante.repository';
import { InternalServerErrorException } from '@nestjs/common';

describe('SriComprobanteRepository (Persistencia Fail-Fast y Sin Fallbacks Silenciosos)', () => {
  let repository: SriComprobanteRepository;
  let mockSupabaseService: any;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      rpc: vi.fn(),
      from: vi.fn(),
    };

    mockSupabaseService = {
      getClientOrThrow: vi.fn().mockReturnValue(mockClient),
      getClient: vi.fn().mockReturnValue(mockClient),
      isAvailable: vi.fn().mockReturnValue(true),
    };

    repository = new SriComprobanteRepository(mockSupabaseService);
  });

  describe('obtenerSiguienteSecuencial', () => {
    it('debe retornar el secuencial formateado a 9 dígitos si la RPC tiene éxito', async () => {
      mockClient.rpc.mockResolvedValueOnce({ data: '123', error: null });

      const sec = await repository.obtenerSiguienteSecuencial('01', '001', '001');
      expect(sec).toBe('000000123');
      expect(mockClient.rpc).toHaveBeenCalledWith('obtener_siguiente_secuencial', {
        p_tipo_doc: '01',
        p_estab: '001',
        p_pto_emi: '001',
      });
    });

    it('debe lanzar InternalServerErrorException si la RPC devuelve un error (NUNCA fabricar secuencial)', async () => {
      mockClient.rpc.mockResolvedValueOnce({ data: null, error: { message: 'DB connection failure' } });

      await expect(
        repository.obtenerSiguienteSecuencial('01', '001', '001')
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('guardarComprobante', () => {
    it('debe retornar el id generado si el insert en la base de datos tiene éxito', async () => {
      const mockSingle = vi.fn().mockResolvedValueOnce({ data: { id: 'uuid-comprobante-1' }, error: null });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      mockClient.from.mockReturnValue({ insert: mockInsert });

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

    it('debe lanzar InternalServerErrorException si el insert en la base de datos falla (NUNCA guardar en memoria)', async () => {
      const mockSingle = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'violación de clave o tabla inaccesible' } });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      mockClient.from.mockReturnValue({ insert: mockInsert });

      await expect(
        repository.guardarComprobante({
          claveAcceso: '2209202601179001691900110010010000000011234567818',
          establecimiento: '001',
          puntoEmision: '001',
          secuencial: '000000001',
          estado: 'FIRMADO',
          xmlGenerado: '<xml/>',
          xmlFirmado: '<xml-firmado/>',
        })
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('crearSriJob', () => {
    it('debe lanzar InternalServerErrorException si la inserción en sri_jobs falla', async () => {
      const mockSingle = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'sri_jobs error' } });
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
      mockClient.from.mockReturnValue({ insert: mockInsert });

      await expect(repository.crearSriJob('comp-uuid-1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('obtenerComprobantePorClave', () => {
    it('debe retornar null cuando no se encuentra el registro (sin error de BD)', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValueOnce({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockClient.from.mockReturnValue({ select: mockSelect });

      const comp = await repository.obtenerComprobantePorClave('clave-inexistente');
      expect(comp).toBeNull();
    });

    it('debe lanzar InternalServerErrorException cuando hay un error real de BD', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'timeout en DB' } });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      mockClient.from.mockReturnValue({ select: mockSelect });

      await expect(repository.obtenerComprobantePorClave('clave-inexistente')).rejects.toThrow(
        InternalServerErrorException
      );
    });
  });
});
