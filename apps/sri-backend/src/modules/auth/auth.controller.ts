import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, LoginSchema } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

function isSecureCookie(): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true') {
    return true;
  }
  const frontendUrl = process.env.FRONTEND_URL || '';
  const isLocalhost = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');
  if (isLocalhost || !frontendUrl) {
    return false;
  }
  return true;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(LoginSchema))
  public async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const usuario = await this.authService.validarCredenciales(dto.email, dto.password);
    const token = await this.authService.emitirToken(usuario);

    const isSecure = isSecureCookie();

    res.cookie('ualdo_session', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      success: true,
      user: usuario,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  public async logout(@Res({ passthrough: true }) res: Response) {
    const isSecure = isSecureCookie();

    res.clearCookie('ualdo_session', {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/',
    });

    return {
      success: true,
      message: 'Sesion cerrada exitosamente',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  public async me(@Req() req: Request & { user: any }) {
    const usuario = await this.authService.obtenerUsuarioActual(req.user.sub);
    return {
      success: true,
      user: usuario,
    };
  }
}
