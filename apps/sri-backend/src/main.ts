import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('SRI-Backend');

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    logger.error('CRITICO: JWT_SECRET no definida o menor a 32 caracteres. Abortando inicio.');
    process.exit(1);
  }

  if (!process.env.POS_API_KEY) {
    if (process.env.NODE_ENV === 'production' || process.env.SRI_AMBIENTE === '2') {
      logger.error('CRITICO: POS_API_KEY no definida en entorno de produccion. Abortando inicio.');
      process.exit(1);
    } else {
      logger.warn('ADVERTENCIA: POS_API_KEY no definida. Configure la variable en su archivo .env');
    }
  }

  const hasDbConfig = Boolean(
    process.env.DATABASE_URL ||
      (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE),
  );
  const requireDb = process.env.SRI_REQUIRE_DB
    ? process.env.SRI_REQUIRE_DB === 'true'
    : process.env.NODE_ENV === 'production' || process.env.SRI_AMBIENTE === '2';

  if (!hasDbConfig && requireDb) {
    logger.error('CRITICO: DATABASE_URL no definida en modo estricto. Abortando inicio.');
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);
  const cookieParserFn = typeof cookieParser === 'function' ? cookieParser : (cookieParser as any)?.default;
  app.use(cookieParserFn());

  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    ...(!isProd ? ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'] : []),
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS bloqueado para origen no autorizado: ${origin}`);
        callback(new Error('Origen no permitido por politica CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  // Escuchar en 0.0.0.0 para que el proxy (Traefik) alcance el contenedor por IPv4
  await app.listen(port, '0.0.0.0');
  logger.log(`Servidor de Facturacion SRI corriendo en el puerto ${port} (ruta /api)`);
}

bootstrap();
