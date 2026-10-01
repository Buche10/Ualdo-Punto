import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomersService } from '../customers.service';
import { Customer } from '@pharmastock/shared';

describe('CustomersService (Manejo de Clientes POS y Privacidad PII)', () => {
  let service: CustomersService;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: vi.fn(),
    };
    service = new CustomersService(mockDatabaseService);
  });

  it('debe buscar cliente por identificacion', async () => {
    const mockCustomer = {
      id: 'cust-1',
      tipo_identificacion: '05',
      identificacion: '1710034065',
      razon_social: 'JUAN PEREZ',
      direccion: 'Quito',
      email: 'juan@gmail.com',
    };

    mockDatabaseService.query.mockResolvedValueOnce([mockCustomer]);

    const result = await service.buscarPorIdentificacion('1710034065');

    expect(result).toBeDefined();
    expect(result?.identificacion).toBe('1710034065');
    expect(result?.razonSocial).toBe('JUAN PEREZ');
    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM public.clientes WHERE identificacion = $1'),
      ['1710034065'],
    );
  });

  it('debe crear o actualizar cliente en la base de datos', async () => {
    const clienteDto: Customer = {
      tipoIdentificacion: '05',
      identificacion: '1710034065',
      razonSocial: 'JUAN PEREZ',
      direccion: 'Quito',
      email: 'juan@gmail.com',
    };

    mockDatabaseService.query.mockResolvedValueOnce([
      {
        id: 'cust-1',
        tipo_identificacion: '05',
        identificacion: '1710034065',
        razon_social: 'JUAN PEREZ',
        direccion: 'Quito',
        telefono: undefined,
        email: 'juan@gmail.com',
      },
    ]);

    const result = await service.crearOActualizar(clienteDto);

    expect(result.id).toBe('cust-1');
    expect(mockDatabaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.clientes'),
      expect.arrayContaining(['05', '1710034065', 'JUAN PEREZ']),
    );
  });
});
