import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Customer } from '@pharmastock/shared';

@Injectable()
export class CustomersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async buscarPorIdentificacion(identificacion: string) {
    try {
      const sql = 'SELECT * FROM public.clientes WHERE identificacion = $1 LIMIT 1';
      const rows = await this.databaseService.query(sql, [identificacion]);
      const data = rows[0];

      if (!data) return null;

      return {
        id: data.id,
        tipoIdentificacion: data.tipo_identificacion,
        identificacion: data.identificacion,
        razonSocial: data.razon_social,
        direccion: data.direccion,
        telefono: data.telefono,
        email: data.email,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(`Error al buscar cliente: ${error.message}`);
    }
  }

  async crearOActualizar(cliente: Customer) {
    try {
      const sql = `
        INSERT INTO public.clientes (
          tipo_identificacion, identificacion, razon_social, direccion, telefono, email, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (identificacion) DO UPDATE SET
          tipo_identificacion = EXCLUDED.tipo_identificacion,
          razon_social = EXCLUDED.razon_social,
          direccion = EXCLUDED.direccion,
          telefono = EXCLUDED.telefono,
          email = EXCLUDED.email,
          updated_at = now()
        RETURNING *
      `;
      const rows = await this.databaseService.query(sql, [
        cliente.tipoIdentificacion,
        cliente.identificacion,
        cliente.razonSocial,
        cliente.direccion,
        cliente.telefono,
        cliente.email,
      ]);
      const data = rows[0];
      if (!data) {
        throw new Error('No se retorno el cliente guardado');
      }

      return {
        id: data.id,
        tipoIdentificacion: data.tipo_identificacion,
        identificacion: data.identificacion,
        razonSocial: data.razon_social,
        direccion: data.direccion,
        telefono: data.telefono,
        email: data.email,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(`Error al guardar cliente: ${error.message}`);
    }
  }
}
