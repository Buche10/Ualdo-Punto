import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './auth.dto';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Extraer token de sesion exclusivamente desde cookie httpOnly o Bearer header
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Acceso no autorizado: sesion requerida');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new UnauthorizedException('Configuracion de seguridad del servidor invalida: JWT_SECRET no disponible');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
        issuer: 'ualdo-negocios',
        audience: 'ualdo-pos',
      });

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Acceso no autorizado: token invalido o expirado');
    }
  }

  private extractToken(request: any): string | null {
    if (request.cookies?.ualdo_session) {
      return request.cookies.ualdo_session;
    }
    if (request.cookies?.auth_token) {
      return request.cookies.auth_token;
    }

    const authHeader = request.headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    return null;
  }
}
