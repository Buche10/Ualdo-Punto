import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getBaseUrl } from '../apiClient';

describe('apiClient getBaseUrl (mismo origen)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('debe resolver a /api por defecto cuando no hay variables de entorno', () => {
    vi.stubEnv('VITE_BACKEND_URL', '');
    vi.stubEnv('VITE_API_URL', '');
    expect(getBaseUrl()).toBe('/api');
  });

  it('debe resolver a /api cuando la variable esta vacia o tiene solo espacios', () => {
    vi.stubEnv('VITE_BACKEND_URL', '   ');
    vi.stubEnv('VITE_API_URL', '');
    expect(getBaseUrl()).toBe('/api');
  });

  it('debe resolver a /api cuando la variable es explicitamente /api', () => {
    vi.stubEnv('VITE_BACKEND_URL', '/api');
    expect(getBaseUrl()).toBe('/api');
  });

  it('debe respetar una URL custom si se define para pruebas locales especificas', () => {
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:3001/api');
    expect(getBaseUrl()).toBe('http://localhost:3001/api');
  });

  it('no debe filtrar ni depender de claves secretas en el cliente', () => {
    expect(import.meta.env.JWT_SECRET).toBeUndefined();
    expect(import.meta.env.DATABASE_URL).toBeUndefined();
    expect(import.meta.env.SRI_P12_PASSWORD).toBeUndefined();
  });
});
