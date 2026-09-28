import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'pharmastock-sri-backend',
      ambiente: process.env.SRI_AMBIENTE === '2' ? '2 (PRODUCCION)' : '1 (PRUEBAS)',
      timestamp: new Date().toISOString(),
    };
  }
}
