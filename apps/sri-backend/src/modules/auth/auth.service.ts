import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SupabaseService } from '../database/supabase.service';
import { UsuarioAutenticado, JwtPayload } from './auth.dto';

// Hash bcrypt precalculado con coste 10 para igualar tiempos y mitigar ataques de temporizacion
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  public async validarCredenciales(email: string, password: string): Promise<UsuarioAutenticado> {
    const normalizado = email.toLowerCase().trim();
    const supabase = this.supabaseService.getClient();

    if (!supabase) {
      this.logger.warn('Base de datos no conectada para validacion de credenciales');
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, empresa_id, email, password_hash, nombre, rol, activo, empresas (id, nombre, ruc, activo)')
      .eq('email', normalizado)
      .maybeSingle();

    if (error || !usuario || !usuario.activo) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const empresa = Array.isArray(usuario.empresas) ? usuario.empresas[0] : usuario.empresas;
    if (empresa && empresa.activo === false) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    this.actualizarUltimoAcceso(usuario.id);

    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      empresa_id: usuario.empresa_id,
      empresa: empresa || null,
    };
  }

  public async emitirToken(usuario: { id: string; empresa_id: string; rol: string }): Promise<string> {
    const payload: JwtPayload = {
      sub: usuario.id,
      empresa_id: usuario.empresa_id,
      rol: usuario.rol,
    };

    return this.jwtService.signAsync(payload, {
      issuer: 'ualdo-negocios',
      audience: 'ualdo-pos',
    });
  }

  public async obtenerUsuarioActual(id: string): Promise<UsuarioAutenticado> {
    const supabase = this.supabaseService.getClient();
    if (!supabase) {
      throw new UnauthorizedException('Servicio de base de datos no disponible');
    }

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, empresa_id, email, nombre, rol, activo, empresas (id, nombre, ruc, activo)')
      .eq('id', id)
      .maybeSingle();

    if (error || !usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    const empresa = Array.isArray(usuario.empresas) ? usuario.empresas[0] : usuario.empresas;
    if (empresa && empresa.activo === false) {
      throw new UnauthorizedException('Empresa inactiva o suspendida');
    }

    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      empresa_id: usuario.empresa_id,
      empresa: empresa || null,
    };
  }

  private async actualizarUltimoAcceso(usuarioId: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      if (!supabase) return;
      await supabase
        .from('usuarios')
        .update({ ultimo_acceso: new Date().toISOString() })
        .eq('id', usuarioId);
    } catch {
      this.logger.warn(`No se pudo actualizar ultimo acceso para usuario ${usuarioId}`);
    }
  }
}
