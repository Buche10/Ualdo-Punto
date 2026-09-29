import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SalesController } from '../../sales/sales.controller';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { VentaResponseDto } from '../../sales/sales.dto';

describe('POS Protected Routes Integration', () => {
  let salesController: SalesController;
  let mockSalesService: any;
  let guard: JwtAuthGuard;
  let mockJwtService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.POS_API_KEY = 'test-pos-api-key-2026';
    process.env.JWT_SECRET = 'test-jwt-secret-minimo-32-caracteres-seguros-2026';

    const mockVentaResponse: VentaResponseDto = {
      ventaId: 'venta-100',
      fecha: new Date().toISOString(),
      totales: {
        subtotal0: 2,
        subtotal15: 0,
        totalSinImpuestos: 2,
        totalDescuento: 0,
        totalIva: 0,
        importeTotal: 2,
      },
      formaPagoCodigo: '01',
      estado: 'COMPLETADA',
    };

    mockSalesService = {
      registrarVenta: vi.fn().mockResolvedValue(mockVentaResponse),
      obtenerVentaPorId: vi.fn().mockResolvedValue(mockVentaResponse),
    };

    salesController = new SalesController(mockSalesService);

    mockJwtService = {
      verifyAsync: vi.fn(),
    };
    guard = new JwtAuthGuard(mockJwtService);
  });

  const createMockContext = (request: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext);

  it('debe rechazar con 401 si no hay sesion de usuario activa al llamar a ventas', async () => {
    const unauthenticatedRequest = {
      headers: {},
      cookies: {},
    };

    const context = createMockContext(unauthenticatedRequest);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Acceso no autorizado: sesion requerida')
    );
  });

  it('debe rechazar peticiones con x-api-key en rutas del POS porque el bypass ya no existe', async () => {
    const apiKeyOnlyRequest = {
      headers: { 'x-api-key': 'test-pos-api-key-2026' },
      cookies: {},
    };

    const context = createMockContext(apiKeyOnlyRequest);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Acceso no autorizado: sesion requerida')
    );
  });

  it('debe permitir la ejecucion de registrarVenta cuando la sesion es valida', async () => {
    const validSessionRequest: any = {
      headers: {},
      cookies: {
        ualdo_session: 'jwt.token.valido',
      },
    };

    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'usr-valwis-1',
      empresa_id: 'emp-valwis',
      rol: 'admin',
    });

    const context = createMockContext(validSessionRequest);
    const canActivate = await guard.canActivate(context);

    expect(canActivate).toBe(true);
    expect(validSessionRequest.user.sub).toBe('usr-valwis-1');

    const dto = {
      cliente: { tipoIdentificacion: '05' as const, identificacion: '1710000001', razonSocial: 'Consumidor' },
      items: [{ productoId: 'p1', codigo: 'C1', descripcion: 'Paracetamol', cantidad: 1, precioUnitario: 2, tarifaIva: 0 }],
      formaPagoCodigo: '01',
    };

    const res = await salesController.registrarVenta(dto);
    expect(res.success).toBe(true);
    expect(res.data.ventaId).toBe('venta-100');
  });
});
