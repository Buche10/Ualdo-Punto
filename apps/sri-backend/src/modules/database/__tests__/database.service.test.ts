import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from '../database.service';

const mClient = {
  query: vi.fn(),
  release: vi.fn(),
};

const mPool = {
  on: vi.fn(),
  query: vi.fn(),
  connect: vi.fn().mockResolvedValue(mClient),
  end: vi.fn().mockResolvedValue(undefined),
};

vi.mock('pg', () => {
  const PoolConstructor = vi.fn().mockImplementation(function () {
    return mPool;
  });
  return {
    Pool: PoolConstructor,
  };
});

describe('DatabaseService (PostgreSQL pg Pool & Fail-Fast)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
    delete process.env.PGHOST;
    delete process.env.PGPORT;
    delete process.env.PGUSER;
    delete process.env.PGPASSWORD;
    delete process.env.PGDATABASE;
    delete process.env.PGSSL;
    delete process.env.SRI_REQUIRE_DB;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('debe lanzar error fatal en constructor si falta configuracion y SRI_REQUIRE_DB=true (Fail-Fast)', () => {
    process.env.SRI_REQUIRE_DB = 'true';

    expect(() => new DatabaseService()).toThrow(
      /Configuracion de base de datos ausente en modo estricto/i,
    );
  });

  it('debe lanzar error al invocar getPoolOrThrow() si el pool no esta inicializado', () => {
    process.env.SRI_REQUIRE_DB = 'false';
    const service = new DatabaseService();

    expect(() => service.getPoolOrThrow()).toThrow(
      /Pool de base de datos no disponible/i,
    );
    expect(service.isAvailable()).toBe(false);
  });

  it('debe inicializar el pool y retornarlo con getPoolOrThrow() cuando DATABASE_URL esta presente', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/mydb';

    const service = new DatabaseService();
    expect(service.isAvailable()).toBe(true);
    expect(service.getPoolOrThrow()).toBeDefined();
    expect(service.getPool()).toBeDefined();
  });

  it('debe inicializar el pool con variables discretas (PGHOST, PGUSER, PGDATABASE)', () => {
    process.env.PGHOST = 'localhost';
    process.env.PGUSER = 'postgres';
    process.env.PGDATABASE = 'ualdo_db';

    const service = new DatabaseService();
    expect(service.isAvailable()).toBe(true);
  });

  it('debe ejecutar query delegando al pool y retornando las filas', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/mydb';
    const service = new DatabaseService();
    const pool = service.getPoolOrThrow();
    (pool.query as any).mockResolvedValueOnce({ rows: [{ id: '1', nombre: 'Test' }] });

    const rows = await service.query('SELECT * FROM test WHERE id = $1', ['1']);
    expect(rows).toEqual([{ id: '1', nombre: 'Test' }]);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', ['1']);
  });

  it('debe ejecutar withTransaction con BEGIN, COMMIT y release en caso exitoso', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/mydb';
    const service = new DatabaseService();
    const pool = service.getPoolOrThrow();
    const client = await pool.connect();

    const resultado = await service.withTransaction(async (c) => {
      await c.query('SELECT 1');
      return 'ok';
    });

    expect(resultado).toBe('ok');
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  it('debe ejecutar ROLLBACK y release si la transaccion falla', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/mydb';
    const service = new DatabaseService();
    const pool = service.getPoolOrThrow();
    const client = await pool.connect();

    await expect(
      service.withTransaction(async () => {
        throw new Error('Error transaccional simulado');
      }),
    ).rejects.toThrow('Error transaccional simulado');

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('debe cerrar el pool al destruir el modulo (onModuleDestroy)', async () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/mydb';
    const service = new DatabaseService();
    const pool = service.getPoolOrThrow();

    await service.onModuleDestroy();
    expect(pool.end).toHaveBeenCalled();
    expect(service.isAvailable()).toBe(false);
  });
});
