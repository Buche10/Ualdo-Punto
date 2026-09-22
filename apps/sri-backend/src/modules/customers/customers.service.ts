import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { Customer } from '@pharmastock/shared';

@Injectable()
export class CustomersService {
  constructor(private readonly supabase: SupabaseService) {}

  async buscarPorIdentificacion(identificacion: string) {
    const client = this.supabase.getClientOrThrow();
    const { data, error } = await client
      .from('clientes')
      .select('*')
      .eq('identificacion', identificacion)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(`Error al buscar cliente: ${error.message}`);
    }

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
  }

  async crearOActualizar(cliente: Customer) {
    const client = this.supabase.getClientOrThrow();
    const payload = {
      tipo_identificacion: cliente.tipoIdentificacion,
      identificacion: cliente.identificacion,
      razon_social: cliente.razonSocial,
      direccion: cliente.direccion,
      telefono: cliente.telefono,
      email: cliente.email,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from('clientes')
      .upsert(payload, { onConflict: 'identificacion' })
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(`Error al guardar cliente: ${error.message}`);
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
  }
}
