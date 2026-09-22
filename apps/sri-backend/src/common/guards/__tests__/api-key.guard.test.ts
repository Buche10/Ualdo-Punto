import { describe, it, expect, beforeEach } from 'vitest';
import { ApiKeyGuard } from '../api-key.guard';
import { UnauthorizedException, ExecutionContext } from '@nestjs/common';

describe('ApiKeyGuard (Seguridad y Autenticación POS)', () => {
  let guard: ApiKeyGuard;

  beforeEach(() => {
    process.env.POS_API_KEY = 'secret-pos-key-12345';
    guard = new ApiKeyGuard();
  });

  const mockContext = (apiKeyHeader?: string): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          ...(apiKeyHeader ? { 'x-api-key': apiKeyHeader } : {}),
        },
      }),
    }),
  } as any);

  it('debe rechazar con UnauthorizedException (401) si falta el header x-api-key', () => {
    expect(() => guard.canActivate(mockContext())).toThrow(UnauthorizedException);
  });

  it('debe rechazar con UnauthorizedException (401) si la clave es incorrecta', () => {
    expect(() => guard.canActivate(mockContext('clave-invalida'))).toThrow(UnauthorizedException);
  });

  it('debe permitir el acceso si la clave coincide exactamente con POS_API_KEY', () => {
    expect(guard.canActivate(mockContext('secret-pos-key-12345'))).toBe(true);
  });
});
