import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let authService: AuthService;
  let mockDatabaseService: any;
  let mockJwtService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDatabaseService = {
      query: vi.fn(),
      isAvailable: vi.fn().mockReturnValue(true),
    };

    mockJwtService = {
      signAsync: vi.fn().mockResolvedValue('fake.jwt.token'),
      verifyAsync: vi.fn(),
    };

    authService = new AuthService(mockDatabaseService, mockJwtService);
  });

  describe('validarCredenciales', () => {
    it('debe autenticar correctamente con email y contrasena validos', async () => {
      const passwordPlana = 'ValwisPass123';
      const passwordHash = await bcrypt.hash(passwordPlana, 10);

      const mockUsuario = {
        id: 'usr-123',
        empresa_id: 'emp-valwis',
        email: 'admin@valwis.farmacia',
        password_hash: passwordHash,
        nombre: 'Admin Valwis',
        rol: 'admin',
        activo: true,
        empresas: {
          id: 'emp-valwis',
          nombre: 'Valwis',
          activo: true,
        },
      };

      mockDatabaseService.query.mockResolvedValueOnce([mockUsuario]);

      const resultado = await authService.validarCredenciales('ADMIN@valwis.farmacia', passwordPlana);

      expect(resultado).toBeDefined();
      expect(resultado.id).toBe('usr-123');
      expect(resultado.email).toBe('admin@valwis.farmacia');
      expect(resultado.rol).toBe('admin');
      expect((resultado as any).password_hash).toBeUndefined();
    });

    it('debe lanzar 401 generico si el usuario no existe ejecutando dummy compare', async () => {
      mockDatabaseService.query.mockResolvedValueOnce([]);

      await expect(
        authService.validarCredenciales('desconocido@farmacia.com', 'clave123'),
      ).rejects.toThrow(new UnauthorizedException('Credenciales invalidas'));
    });

    it('debe lanzar 401 generico si la contrasena es incorrecta', async () => {
      const passwordHash = await bcrypt.hash('claveCorrecta123', 10);

      const mockUsuario = {
        id: 'usr-123',
        empresa_id: 'emp-valwis',
        email: 'operador@valwis.farmacia',
        password_hash: passwordHash,
        nombre: 'Operador Valwis',
        rol: 'operador',
        activo: true,
        empresas: { id: 'emp-valwis', nombre: 'Valwis', activo: true },
      };

      mockDatabaseService.query.mockResolvedValueOnce([mockUsuario]);

      await expect(
        authService.validarCredenciales('operador@valwis.farmacia', 'claveIncorrecta'),
      ).rejects.toThrow(new UnauthorizedException('Credenciales invalidas'));
    });

    it('debe lanzar 401 si el usuario esta inactivo ejecutando dummy compare', async () => {
      const passwordHash = await bcrypt.hash('clave123', 10);

      const mockUsuario = {
        id: 'usr-inactive',
        empresa_id: 'emp-valwis',
        email: 'inactivo@valwis.farmacia',
        password_hash: passwordHash,
        activo: false,
        empresas: { id: 'emp-valwis', nombre: 'Valwis', activo: true },
      };

      mockDatabaseService.query.mockResolvedValueOnce([mockUsuario]);

      await expect(
        authService.validarCredenciales('inactivo@valwis.farmacia', 'clave123'),
      ).rejects.toThrow(new UnauthorizedException('Credenciales invalidas'));
    });

    it('debe lanzar 401 si la empresa esta suspendida o inactiva', async () => {
      const passwordHash = await bcrypt.hash('clave123', 10);

      const mockUsuario = {
        id: 'usr-123',
        empresa_id: 'emp-valwis',
        email: 'operador@valwis.farmacia',
        password_hash: passwordHash,
        activo: true,
        empresas: { id: 'emp-valwis', nombre: 'Valwis', activo: false },
      };

      mockDatabaseService.query.mockResolvedValueOnce([mockUsuario]);

      await expect(
        authService.validarCredenciales('operador@valwis.farmacia', 'clave123'),
      ).rejects.toThrow(new UnauthorizedException('Credenciales invalidas'));
    });
  });

  describe('emitirToken', () => {
    it('debe emitir un JWT con el payload adecuado (sub, empresa_id, rol) e issuer/audience', async () => {
      const usuario = {
        id: 'usr-999',
        empresa_id: 'emp-valwis',
        rol: 'admin',
      };

      const token = await authService.emitirToken(usuario);

      expect(token).toBe('fake.jwt.token');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: 'usr-999',
          empresa_id: 'emp-valwis',
          rol: 'admin',
        },
        {
          issuer: 'ualdo-negocios',
          audience: 'ualdo-pos',
        },
      );
    });
  });

  describe('obtenerUsuarioActual', () => {
    it('debe retornar los datos del usuario sanitizados', async () => {
      const mockUsuario = {
        id: 'usr-123',
        empresa_id: 'emp-valwis',
        email: 'admin@valwis.farmacia',
        nombre: 'Admin Valwis',
        rol: 'admin',
        activo: true,
        empresas: { id: 'emp-valwis', nombre: 'Valwis', ruc: '1790000000001', activo: true },
      };

      mockDatabaseService.query.mockResolvedValueOnce([mockUsuario]);

      const res = await authService.obtenerUsuarioActual('usr-123');

      expect(res.id).toBe('usr-123');
      expect(res.email).toBe('admin@valwis.farmacia');
      expect(res.empresa?.nombre).toBe('Valwis');
      expect((res as any).password_hash).toBeUndefined();
    });
  });
});
