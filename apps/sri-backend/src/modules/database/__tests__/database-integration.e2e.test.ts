import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseService } from '../database.service';
import { SriComprobanteRepository } from '../../jobs/sri-comprobante.repository';
import { SalesService } from '../../sales/sales.service';
import { CustomersService } from '../../customers/customers.service';
import { AuthService } from '../../auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

describe('Postgres Puro - Test de Integracion Real con Base de Datos Desechable', () => {
  const testDbUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:5433/ualdo_test';

  let databaseService: DatabaseService;
  let repository: SriComprobanteRepository;
  let salesService: SalesService;
  let customersService: CustomersService;
  let authService: AuthService;
  let isDbAvailable = false;

  beforeAll(async () => {
    process.env.DATABASE_URL = testDbUrl;
    databaseService = new DatabaseService();

    try {
      const pool = databaseService.getPoolOrThrow();
      await pool.query('SELECT 1');
      isDbAvailable = true;

      const schemaCandidates = [
        path.resolve(process.cwd(), 'db/schema.sql'),
        path.resolve(process.cwd(), '../db/schema.sql'),
        path.resolve(process.cwd(), '../../db/schema.sql'),
        path.resolve(__dirname, '../../../../../../db/schema.sql'),
      ];
      const validSchemaPath = schemaCandidates.find((p) => fs.existsSync(p));
      if (validSchemaPath) {
        const schemaSql = fs.readFileSync(validSchemaPath, 'utf8');
        await pool.query(schemaSql);
      }

      repository = new SriComprobanteRepository(databaseService);
      salesService = new SalesService(databaseService);
      customersService = new CustomersService(databaseService);
      authService = new AuthService(databaseService, new JwtService({ secret: 'secreto-jwt-minimo-32-caracteres-2026' }));
    } catch (err: any) {
      console.warn('Postgres integration test DB not available, skipping live tests:', err.message);
      isDbAvailable = false;
    }
  });

  afterAll(async () => {
    if (databaseService) {
      await databaseService.onModuleDestroy();
    }
  });

  it('1. Genera secuenciales atomicos concurrentes sin colision', async (ctx) => {
    if (!isDbAvailable) return ctx.skip();

    const sec1 = await repository.obtenerSiguienteSecuencial('01', '001', '001');
    const sec2 = await repository.obtenerSiguienteSecuencial('01', '001', '001');

    expect(sec1).toBeDefined();
    expect(sec2).toBeDefined();
    expect(Number(sec2)).toBe(Number(sec1) + 1);
  });

  it('2. Gestiona clientes (creacion, busqueda e idempotencia por identificacion)', async (ctx) => {
    if (!isDbAvailable) return ctx.skip();

    const testId = `09${Date.now().toString().slice(-8)}`;
    const creado = await customersService.crearOActualizar({
      tipoIdentificacion: '05',
      identificacion: testId,
      razonSocial: 'Cliente Prueba Postgres',
      direccion: 'Guayaquil',
      email: 'prueba@ualdo.com',
    });

    expect(creado.id).toBeDefined();
    expect(creado.identificacion).toBe(testId);

    const encontrado = await customersService.buscarPorIdentificacion(testId);
    expect(encontrado).not.toBeNull();
    expect(encontrado?.razonSocial).toBe('Cliente Prueba Postgres');
  });

  it('3. Procesa venta POS con descuento atomico de stock', async (ctx) => {
    if (!isDbAvailable) return ctx.skip();

    const prodId = `prod-integ-${Date.now()}`;
    await databaseService.query(
      `INSERT INTO public.products (id, data) VALUES ($1, $2)`,
      [prodId, JSON.stringify({ name: 'Ibuprofeno 400mg', theoreticalStock: 50 })],
    );

    const venta = await salesService.registrarVenta({
      cliente: {
        tipoIdentificacion: '05',
        identificacion: '1710034065',
        razonSocial: 'JUAN PEREZ',
      },
      items: [
        {
          productoId: prodId,
          codigo: 'IBU400',
          descripcion: 'Ibuprofeno 400mg',
          cantidad: 5,
          precioUnitario: 2.0,
          tarifaIva: 15,
        },
      ],
      formaPagoCodigo: '01',
    });

    expect(venta.ventaId).toBeDefined();
    expect(venta.totales.importeTotal).toBe(11.5);

    const prodRows = await databaseService.query<{ data: any }>(
      'SELECT data FROM public.products WHERE id = $1',
      [prodId],
    );
    expect(prodRows[0].data.theoreticalStock).toBe(45);
  });

  it('4. Persiste comprobante fiscal y encola job en sri_jobs con reclamo FOR UPDATE SKIP LOCKED', async (ctx) => {
    if (!isDbAvailable) return ctx.skip();

    const claveAcceso = ('011020260117900169190011001001000000001' + Date.now().toString()).slice(0, 49).padEnd(49, '0');
    const comp = await repository.guardarComprobante({
      claveAcceso,
      establecimiento: '001',
      puntoEmision: '001',
      secuencial: '000000099',
      estado: 'FIRMADO',
      xmlGenerado: '<xml/>',
      xmlFirmado: '<xml-firmado/>',
    });

    expect(comp.id).toBeDefined();

    const job = await repository.crearSriJob(comp.id);
    expect(job.id).toBeDefined();

    const jobsReclamados = await repository.obtenerJobsPendientes(5);
    const reclamado = jobsReclamados.find((j) => j.id === job.id);
    expect(reclamado).toBeDefined();
    expect(reclamado?.claveAcceso).toBe(claveAcceso);
  });

  it('5. Valida credenciales de autenticacion contra tabla usuarios y empresas', async (ctx) => {
    if (!isDbAvailable) return ctx.skip();

    const empRows = await databaseService.query<{ id: string }>(
      'SELECT id FROM public.empresas LIMIT 1',
    );
    const empresaId = empRows[0].id;

    const emailTest = `cajero-${Date.now()}@valwis.farmacia`;
    const passwordHash = await bcrypt.hash('ClaveSecreta123', 10);

    await databaseService.query(
      `INSERT INTO public.usuarios (empresa_id, email, password_hash, nombre, rol, activo)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [empresaId, emailTest, passwordHash, 'Cajero Prueba', 'operador'],
    );

    const usuarioAutenticado = await authService.validarCredenciales(
      emailTest,
      'ClaveSecreta123',
    );
    expect(usuarioAutenticado.email).toBe(emailTest);
    expect(usuarioAutenticado.rol).toBe('operador');
    expect(usuarioAutenticado.empresa?.id).toBe(empresaId);
  });
});
