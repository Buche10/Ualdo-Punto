import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const expectedKey = process.env.POS_API_KEY;
    if (!expectedKey) {
      throw new InternalServerErrorException(
        'Configuración de seguridad del servidor inválida: POS_API_KEY no definida'
      );
    }

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Acceso no autorizado: header x-api-key requerido');
    }

    const expectedBuffer = Buffer.from(expectedKey, 'utf8');
    const actualBuffer = Buffer.from(apiKey, 'utf8');

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new UnauthorizedException('Acceso no autorizado: x-api-key inválido');
    }

    return true;
  }
}
