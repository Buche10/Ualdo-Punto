import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApiKeyGuard } from '../api-key.guard';
import { UnauthorizedException, InternalServerErrorException, ExecutionContext } from '@nestjs/common';

describe('ApiKeyGuard (Seguridad y Autenticación POS)', () => {
  let guard: ApiKeyGuard;
  const originalEnv = process.env.POS_API_KEY;

  beforeEach(() => {
    process.env.POS_API_KEY = 'secret-pos-key-12345';
    guard = new ApiKeyGuard();
  });

  afterEach(() => {
    process.env.POS_API_KEY = originalEnv;
  });

  const mockContext = (headers: Record<string, string> = {}, query: Record<string, string> = {}): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        query,
      }),
    }),
  } as any);

  it('debe fallar cerrado con InternalServerErrorException si POS_API_KEY no está configurada', () => {
    delete process.env.POS_API_KEY;
    expect(() => guard.canActivate(mockContext({ 'x-api-key': 'alguna-clave' }))).toThrow(
      InternalServerErrorException
    );
  });

  it('debe rechazar con UnauthorizedException (401) si falta el header x-api-key', () => {
    expect(() => guard.canActivate(mockContext())).toThrow(UnauthorizedException);
  });

  it('debe rechazar con UnauthorizedException si la clave se envía por query string (M1)', () => {
    // La clave enviada solo en query string no debe ser aceptada
    expect(() => guard.canActivate(mockContext({}, { apiKey: 'secret-pos-key-12345' }))).toThrow(
      UnauthorizedException
    );
  });

  it('debe rechazar con UnauthorizedException (401) si la clave es incorrecta', () => {
    expect(() => guard.canActivate(mockContext({ 'x-api-key': 'clave-invalida' }))).toThrow(
      UnauthorizedException
    );
  });

  it('debe permitir el acceso si la clave coincide exactamente con POS_API_KEY en el header', () => {
    expect(guard.canActivate(mockContext({ 'x-api-key': 'secret-pos-key-12345' }))).toBe(true);
  });
});
