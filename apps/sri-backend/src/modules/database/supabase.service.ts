import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Asegurar carga de variables de entorno desde la raíz o directorio actual
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    const requireDb = process.env.SRI_REQUIRE_DB
      ? process.env.SRI_REQUIRE_DB === 'true'
      : process.env.SRI_AMBIENTE === '2' || process.env.NODE_ENV === 'production';

    if (!supabaseUrl || !supabaseKey) {
      if (requireDb) {
        throw new Error(
          'Configuración de Supabase ausente en modo estricto (SRI_REQUIRE_DB). Es obligatorio definir SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para emitir comprobantes fiscales.',
        );
      }
      this.logger.warn(
        'SUPABASE_URL o SUPABASE_KEY no definidos. Modo sin conexión activa a Supabase.',
      );
      return;
    }

    try {
      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      this.logger.log('Cliente Supabase inicializado correctamente.');
    } catch (err) {
      this.logger.error(`Error al inicializar cliente Supabase: ${(err as Error).message}`);
      if (requireDb) throw err;
    }
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public getClientOrThrow(): SupabaseClient {
    if (!this.client) {
      throw new Error(
        'Cliente Supabase no disponible. Se requiere conexión activa a la base de datos fiscal.',
      );
    }
    return this.client;
  }

  public isAvailable(): boolean {
    return this.client !== null;
  }
}
