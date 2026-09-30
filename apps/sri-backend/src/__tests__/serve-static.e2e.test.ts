import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppModule } from '../app.module';

describe('Servidor unificado NestJS (Front + /api)', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  let tempStaticDir: string;

  beforeAll(async () => {
    tempStaticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ualdo-front-test-'));
    const assetsDir = path.join(tempStaticDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });

    fs.writeFileSync(
      path.join(tempStaticDir, 'index.html'),
      '<!DOCTYPE html><html><head><title>Ualdo Negocios POS</title></head><body><div id="root">POS App</div></body></html>',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(assetsDir, 'test-bundle.js'),
      'console.log("ualdo bundle");',
      'utf-8',
    );

    process.env.SERVE_STATIC_ROOT_PATH = tempStaticDir;
    process.env.JWT_SECRET = 'clave_secreta_de_prueba_para_jwt_super_segura_32';

    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 3001;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (tempStaticDir && fs.existsSync(tempStaticDir)) {
      fs.rmSync(tempStaticDir, { recursive: true, force: true });
    }
    delete process.env.SERVE_STATIC_ROOT_PATH;
  });

  it('debe responder 200 y servir el HTML del front en /', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Ualdo Negocios POS');
  });

  it('debe servir archivos estaticos directamente', async () => {
    const res = await fetch(`${baseUrl}/assets/test-bundle.js`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('ualdo bundle');
  });

  it('debe responder 200 con index.html como fallback para rutas SPA no-api', async () => {
    const res = await fetch(`${baseUrl}/ventas/pos-terminal`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('Ualdo Negocios POS');
  });

  it('debe responder 200 en /api/health sin ser tapado por el frontend', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('pharmastock-sri-backend');
  });
});
