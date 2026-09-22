import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || request.query?.apiKey;
    const expectedKey = process.env.POS_API_KEY || 'pharmastock-pos-secure-key-2026';

    if (!apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Acceso no autorizado: x-api-key inválido o ausente');
    }

    return true;
  }
}
