import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { AuthModule } from '../auth.module';
import { DatabaseService } from '../../database/database.service';

describe('AuthModule Bootstrap Validation', () => {
  beforeEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('debe fallar al arrancar si JWT_SECRET no esta definido', async () => {
    delete process.env.JWT_SECRET;

    const modulePromise = Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ isAvailable: () => false, getPool: () => null })
      .compile();

    await expect(modulePromise).rejects.toThrow(
      'JWT_SECRET debe estar definido y tener al menos 32 caracteres',
    );
  });

  it('debe fallar al arrancar si JWT_SECRET tiene menos de 32 caracteres', async () => {
    process.env.JWT_SECRET = 'clave-demasiado-corta';

    const modulePromise = Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ isAvailable: () => false, getPool: () => null })
      .compile();

    await expect(modulePromise).rejects.toThrow(
      'JWT_SECRET debe estar definido y tener al menos 32 caracteres',
    );
  });

  it('debe inicializar correctamente si JWT_SECRET tiene al menos 32 caracteres', async () => {
    process.env.JWT_SECRET = 'secreto-valido-con-mas-de-32-caracteres-de-longitud-2026';

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ isAvailable: () => false, getPool: () => null })
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
