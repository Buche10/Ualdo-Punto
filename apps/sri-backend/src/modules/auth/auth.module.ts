import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Global()
@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET debe estar definido y tener al menos 32 caracteres');
        }
        return {
          secret,
          signOptions: {
            expiresIn: '8h',
            issuer: 'ualdo-negocios',
            audience: 'ualdo-pos',
          },
          verifyOptions: {
            issuer: 'ualdo-negocios',
            audience: 'ualdo-pos',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
