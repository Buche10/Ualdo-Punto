import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('SRI-Backend');

  if (!process.env.POS_API_KEY) {
    if (process.env.NODE_ENV === 'production' || process.env.SRI_AMBIENTE === '2') {
      logger.error('CRÍTICO: POS_API_KEY no definida en entorno de producción. Abortando inicio.');
      process.exit(1);
    } else {
      logger.warn('ADVERTENCIA: POS_API_KEY no definida. Configure la variable en su archivo .env');
    }
  }

  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (scripts locales o llamadas server-to-server)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS bloqueado para origen no autorizado: ${origin}`);
        callback(new Error('Origen no permitido por política CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Servidor de Facturación SRI corriendo en http://localhost:${port}/api`);
}

bootstrap();
