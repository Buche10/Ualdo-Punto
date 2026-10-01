import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, PoolConfig } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Asegurar carga de variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;

  constructor() {
    const config = this.buildPoolConfig();
    const requireDb = process.env.SRI_REQUIRE_DB
      ? process.env.SRI_REQUIRE_DB === 'true'
      : process.env.SRI_AMBIENTE === '2' || process.env.NODE_ENV === 'production';

    if (!config) {
      if (requireDb) {
        throw new Error(
          'Configuracion de base de datos ausente en modo estricto (SRI_REQUIRE_DB). Es obligatorio definir DATABASE_URL para la persistencia fiscal.',
        );
      }
      this.logger.warn('DATABASE_URL no definida. Modo sin conexion activa a base de datos.');
      return;
    }

    try {
      this.pool = new Pool(config);
      this.pool.on('error', (err) => {
        this.logger.error(`Error inesperado en pool de PostgreSQL: ${err.message}`);
      });
      this.logger.log('Pool de PostgreSQL inicializado correctamente.');
    } catch (err) {
      this.logger.error(`Error al inicializar pool de PostgreSQL: ${(err as Error).message}`);
      if (requireDb) throw err;
    }
  }

  private buildPoolConfig(): PoolConfig | null {
    const databaseUrl = process.env.DATABASE_URL;
    const host = process.env.PGHOST;
    const user = process.env.PGUSER;
    const database = process.env.PGDATABASE;
    const password = process.env.PGPASSWORD;
    const port = process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432;
    const sslMode = process.env.PGSSL;

    const sslConfig = sslMode === 'require' ? { rejectUnauthorized: false } : undefined;

    if (databaseUrl) {
      return {
        connectionString: databaseUrl,
        ssl: sslConfig,
        max: process.env.PGMAX_CONNECTIONS ? parseInt(process.env.PGMAX_CONNECTIONS, 10) : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      };
    }

    if (host && user && database) {
      return {
        host,
        port,
        user,
        password,
        database,
        ssl: sslConfig,
        max: process.env.PGMAX_CONNECTIONS ? parseInt(process.env.PGMAX_CONNECTIONS, 10) : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      };
    }

    return null;
  }

  public getPool(): Pool | null {
    return this.pool;
  }

  public getPoolOrThrow(): Pool {
    if (!this.pool) {
      throw new Error(
        'Pool de base de datos no disponible. Se requiere conexion activa a PostgreSQL.',
      );
    }
    return this.pool;
  }

  public isAvailable(): boolean {
    return this.pool !== null;
  }

  public async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const pool = this.getPoolOrThrow();
    const result = await pool.query(text, params);
    return result.rows as T[];
  }

  public async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = this.getPoolOrThrow();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        this.logger.error(`Error en ROLLBACK de transaccion: ${(rollbackErr as Error).message}`);
      }
      throw err;
    } finally {
      client.release();
    }
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      this.logger.log('Cerrando pool de conexiones de PostgreSQL.');
      await this.pool.end();
      this.pool = null;
    }
  }
}
