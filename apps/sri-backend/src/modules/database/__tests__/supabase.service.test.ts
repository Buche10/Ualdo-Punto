import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SupabaseService } from '../supabase.service';

describe('SupabaseService (Fail-Fast y Modo Estricto)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_KEY;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.SRI_REQUIRE_DB;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('debe lanzar error fatal en el constructor si falta configuración y SRI_REQUIRE_DB=true (Fail-Fast)', () => {
    process.env.SRI_REQUIRE_DB = 'true';

    expect(() => new SupabaseService()).toThrow(
      /Configuración de Supabase ausente en modo estricto/i
    );
  });

  it('debe lanzar error al invocar getClientOrThrow() si el cliente no está inicializado', () => {
    process.env.SRI_REQUIRE_DB = 'false';
    const service = new SupabaseService();

    expect(() => service.getClientOrThrow()).toThrow(
      /Cliente Supabase no disponible/i
    );
  });

  it('debe inicializar el cliente y retornarlo con getClientOrThrow() cuando las credenciales están presentes', () => {
    process.env.SUPABASE_URL = 'https://dummy.supabase.co';
    process.env.SUPABASE_KEY = 'dummy-service-role-key';

    const service = new SupabaseService();
    expect(service.isAvailable()).toBe(true);
    expect(service.getClientOrThrow()).toBeDefined();
  });
});
