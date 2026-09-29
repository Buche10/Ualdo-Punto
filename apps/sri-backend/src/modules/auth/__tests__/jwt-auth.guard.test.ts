import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockJwtService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-valido-con-mas-de-32-caracteres-2026';

    mockJwtService = {
      verifyAsync: vi.fn(),
    };

    guard = new JwtAuthGuard(mockJwtService);
  });

  const createMockContext = (request: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext);

  it('debe rechazar con 401 si no hay cookies ni headers de autorizacion', async () => {
    const context = createMockContext({
      headers: {},
      cookies: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Acceso no autorizado: sesion requerida')
    );
  });

  it('debe rechazar con 401 si la peticion solo incluye x-api-key (bypass eliminado)', async () => {
    const context = createMockContext({
      headers: { 'x-api-key': 'clave-servicio-cualquiera' },
      cookies: {},
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Acceso no autorizado: sesion requerida')
    );
  });

  it('debe rechazar con 401 si JWT_SECRET no esta definido o es menor a 32 caracteres', async () => {
    process.env.JWT_SECRET = 'corta';

    const context = createMockContext({
      headers: {},
      cookies: { ualdo_session: 'token.cualquiera' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Configuracion de seguridad del servidor invalida: JWT_SECRET no disponible')
    );
  });

  it('debe rechazar con 401 si el token JWT es invalido o expiro', async () => {
    mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    const context = createMockContext({
      headers: {},
      cookies: { ualdo_session: 'token.expirado.invalido' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Acceso no autorizado: token invalido o expirado')
    );
  });

  it('debe permitir acceso y verificar issuer y audience cuando la cookie contiene un JWT valido', async () => {
    const mockPayload = {
      sub: 'usr-valwis-1',
      empresa_id: 'emp-valwis',
      rol: 'admin',
    };
    mockJwtService.verifyAsync.mockResolvedValue(mockPayload);

    const request: any = {
      headers: {},
      cookies: { ualdo_session: 'token.valido.jwt' },
    };
    const context = createMockContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(mockPayload);
    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('token.valido.jwt', {
      secret: process.env.JWT_SECRET,
      issuer: 'ualdo-negocios',
      audience: 'ualdo-pos',
    });
  });

  it('debe permitir acceso cuando se proporciona Authorization Bearer header valido', async () => {
    const mockPayload = {
      sub: 'usr-valwis-2',
      empresa_id: 'emp-valwis',
      rol: 'operador',
    };
    mockJwtService.verifyAsync.mockResolvedValue(mockPayload);

    const request: any = {
      headers: { authorization: 'Bearer token.bearer.valido' },
      cookies: {},
    };
    const context = createMockContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(mockPayload);
  });
});
