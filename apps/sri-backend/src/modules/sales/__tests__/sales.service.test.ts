import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SalesService } from '../sales.service';
import { BadRequestException, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { CrearVentaDto } from '../sales.dto';

describe('SalesService (Gestion Transaccional de Ventas y Descuento de Stock)', () => {
  let service: SalesService;
  let mockDatabaseService: any;

  const validVentaDto: CrearVentaDto = {
    cliente: {
      tipoIdentificacion: '05',
      identificacion: '1710034065',
      razonSocial: 'JUAN PEREZ',
      direccion: 'Quito',
      email: 'juan@gmail.com',
    },
    items: [
      {
        productoId: 'prod-1',
        codigo: 'MED01',
        descripcion: 'Paracetamol 500mg',
        cantidad: 2,
        precioUnitario: 1.50,
        descuento: 0,
        tarifaIva: 0,
        codigoPorcentajeIva: '0',
      },
      {
        productoId: 'prod-2',
        codigo: 'INS01',
        descripcion: 'Alcohol antiseptico 500ml',
        cantidad: 1,
        precioUnitario: 2.00,
        descuento: 0,
        tarifaIva: 15,
        codigoPorcentajeIva: '4',
      },
    ],
    formaPagoCodigo: '01',
  };

  beforeEach(() => {
    mockDatabaseService = {
      query: vi.fn(),
    };

    service = new SalesService(mockDatabaseService);
  });

  it('debe registrar la venta atomicamente y retornar ventaId con totales calculados', async () => {
    mockDatabaseService.query.mockResolvedValueOnce([{ venta_id: 'uuid-venta-123' }]);

    const result = await service.registrarVenta(validVentaDto);

    expect(result.ventaId).toBe('uuid-venta-123');
    expect(result.totales.subtotal0).toBe(3.00);
    expect(result.totales.subtotal15).toBe(2.00);
    expect(result.totales.totalIva).toBe(0.30);
    expect(result.totales.importeTotal).toBe(5.30);
    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT public.procesar_venta_pos'),
      expect.anything(),
    );
  });

  it('debe rechazar ventas mayores a $50 a Consumidor Final sin identificacion (SRI)', async () => {
    const dtoExcedido: CrearVentaDto = {
      ...validVentaDto,
      cliente: {
        tipoIdentificacion: '07',
        identificacion: '9999999999999',
        razonSocial: 'CONSUMIDOR FINAL',
      },
      items: [
        {
          productoId: 'prod-caro',
          codigo: 'CARO',
          descripcion: 'Medicamento Costoso',
          cantidad: 1,
          precioUnitario: 60.00,
          descuento: 0,
          tarifaIva: 0,
          codigoPorcentajeIva: '0',
        },
      ],
    };

    await expect(service.registrarVenta(dtoExcedido)).rejects.toThrow(BadRequestException);
    expect(mockDatabaseService.query).not.toHaveBeenCalled();
  });

  it('debe lanzar ConflictException (409) si la base de datos reporta STOCK_INSUFICIENTE', async () => {
    mockDatabaseService.query.mockRejectedValueOnce(
      new Error('STOCK_INSUFICIENTE: Producto prod-1 tiene stock 1 pero se solicitaron 2'),
    );

    await expect(service.registrarVenta(validVentaDto)).rejects.toThrow(ConflictException);
  });

  it('debe lanzar NotFoundException (404) si el producto no existe en el catalogo', async () => {
    mockDatabaseService.query.mockRejectedValueOnce(
      new Error('PRODUCTO_NO_ENCONTRADO: prod-invalido'),
    );

    await expect(service.registrarVenta(validVentaDto)).rejects.toThrow(NotFoundException);
  });

  it('debe lanzar InternalServerErrorException si la base de datos falla genericamente', async () => {
    mockDatabaseService.query.mockRejectedValueOnce(
      new Error('Connection timeout in database'),
    );

    await expect(service.registrarVenta(validVentaDto)).rejects.toThrow(InternalServerErrorException);
  });
});
