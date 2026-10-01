import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { UsuarioAutenticado, JwtPayload } from './auth.dto';

// Hash bcrypt precalculado con coste 10 para igualar tiempos y mitigar ataques de temporizacion
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  public async validarCredenciales(email: string, password: string): Promise<UsuarioAutenticado> {
    const normalizado = email.toLowerCase().trim();

    if (!this.databaseService.isAvailable()) {
      this.logger.warn('Base de datos no conectada para validacion de credenciales');
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedException('Credenciales invalidas');
    }

    let usuario: any = null;
    try {
      const sql = `
        SELECT u.id, u.empresa_id, u.email, u.password_hash, u.nombre, u.rol, u.activo,
          row_to_json(e.*) AS empresas
        FROM public.usuarios u
        LEFT JOIN public.empresas e ON e.id = u.empresa_id
        WHERE lower(u.email) = lower($1)
        LIMIT 1
      `;
      const rows = await this.databaseService.query(sql, [normalizado]);
      usuario = rows[0];
    } catch {
      usuario = null;
    }

    if (!usuario || !usuario.activo) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const empresa = usuario.empresas;
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
    if (!this.databaseService.isAvailable()) {
      throw new UnauthorizedException('Servicio de base de datos no disponible');
    }

    let usuario: any = null;
    try {
      const sql = `
        SELECT u.id, u.empresa_id, u.email, u.nombre, u.rol, u.activo,
          row_to_json(e.*) AS empresas
        FROM public.usuarios u
        LEFT JOIN public.empresas e ON e.id = u.empresa_id
        WHERE u.id = $1
        LIMIT 1
      `;
      const rows = await this.databaseService.query(sql, [id]);
      usuario = rows[0];
    } catch (error: any) {
      throw new UnauthorizedException(`Error de consulta: ${error.message}`);
    }

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    const empresa = usuario.empresas;
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
      if (!this.databaseService.isAvailable()) return;
      await this.databaseService.query(
        'UPDATE public.usuarios SET ultimo_acceso = now() WHERE id = $1',
        [usuarioId],
      );
    } catch {
      this.logger.warn(`No se pudo actualizar ultimo acceso para usuario ${usuarioId}`);
    }
  }
}
