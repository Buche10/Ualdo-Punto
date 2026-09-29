import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from '../auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;
  let mockResponse: any;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NODE_ENV;
    delete process.env.COOKIE_SECURE;
    delete process.env.FRONTEND_URL;

    mockAuthService = {
      validarCredenciales: vi.fn(),
      emitirToken: vi.fn(),
      obtenerUsuarioActual: vi.fn(),
    };

    mockResponse = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };

    controller = new AuthController(mockAuthService);
  });

  describe('login', () => {
    it('debe validar credenciales, emitir token y fijar cookie httpOnly', async () => {
      const mockUsuario = {
        id: 'usr-1',
        email: 'admin@valwis.farmacia',
        nombre: 'Admin Valwis',
        rol: 'admin',
        empresa_id: 'emp-1',
        empresa: { id: 'emp-1', nombre: 'Valwis' },
      };

      mockAuthService.validarCredenciales.mockResolvedValue(mockUsuario);
      mockAuthService.emitirToken.mockResolvedValue('token.jwt.firmado');

      const body = {
        email: 'admin@valwis.farmacia',
        password: 'PasswordValwis2026',
      };

      const resultado = await controller.login(body, mockResponse);

      expect(mockAuthService.validarCredenciales).toHaveBeenCalledWith(
        'admin@valwis.farmacia',
        'PasswordValwis2026'
      );
      expect(mockAuthService.emitirToken).toHaveBeenCalledWith(mockUsuario);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'ualdo_session',
        'token.jwt.firmado',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        })
      );
      expect(resultado.success).toBe(true);
      expect(resultado.user).toEqual(mockUsuario);
    });

    it('debe emitir cookie con Secure=true en entorno no local o produccion', async () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'https://pos.ualdonegocios.com';

      mockAuthService.validarCredenciales.mockResolvedValue({
        id: 'usr-prod',
        email: 'admin@valwis.farmacia',
        empresa_id: 'emp-1',
        rol: 'admin',
      });
      mockAuthService.emitirToken.mockResolvedValue('token.prod');

      await controller.login({ email: 'admin@valwis.farmacia', password: 'pass' }, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'ualdo_session',
        'token.prod',
        expect.objectContaining({
          secure: true,
          httpOnly: true,
          sameSite: 'strict',
        })
      );
    });
  });

  describe('logout', () => {
    it('debe limpiar la cookie de sesion httpOnly', async () => {
      const resultado = await controller.logout(mockResponse);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        'ualdo_session',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        })
      );
      expect(resultado.success).toBe(true);
      expect(resultado.message).toContain('Sesion cerrada');
    });
  });

  describe('me', () => {
    it('debe devolver los datos del usuario actual autenticado', async () => {
      const mockUsuario = {
        id: 'usr-current',
        email: 'operador@valwis.farmacia',
        nombre: 'Operador Valwis',
        rol: 'operador',
        empresa_id: 'emp-1',
        empresa: { id: 'emp-1', nombre: 'Valwis' },
      };

      mockAuthService.obtenerUsuarioActual.mockResolvedValue(mockUsuario);

      const mockRequest = {
        user: { sub: 'usr-current', empresa_id: 'emp-1', rol: 'operador' },
      } as any;

      const resultado = await controller.me(mockRequest);

      expect(mockAuthService.obtenerUsuarioActual).toHaveBeenCalledWith('usr-current');
      expect(resultado.success).toBe(true);
      expect(resultado.user).toEqual(mockUsuario);
    });
  });
});
