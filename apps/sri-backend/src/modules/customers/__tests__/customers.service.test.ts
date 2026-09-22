import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomersService } from '../customers.service';
import { Customer } from '@pharmastock/shared';

describe('CustomersService (Manejo de Clientes POS y Privacidad PII)', () => {
  let service: CustomersService;
  let mockSupabaseService: any;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      from: vi.fn(),
    };
    mockSupabaseService = {
      getClientOrThrow: vi.fn().mockReturnValue(mockClient),
    };
    service = new CustomersService(mockSupabaseService);
  });

  it('debe buscar cliente por identificación', async () => {
    const mockCustomer = {
      id: 'cust-1',
      tipo_identificacion: '05',
      identificacion: '1710034065',
      razon_social: 'JUAN PEREZ',
      direccion: 'Quito',
      email: 'juan@gmail.com',
    };

    const maybeSingleMock = vi.fn().mockResolvedValueOnce({ data: mockCustomer, error: null });
    const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockClient.from.mockReturnValue({ select: selectMock });

    const result = await service.buscarPorIdentificacion('1710034065');

    expect(result).toBeDefined();
    expect(result?.identificacion).toBe('1710034065');
    expect(result?.razonSocial).toBe('JUAN PEREZ');
    expect(mockClient.from).toHaveBeenCalledWith('clientes');
  });

  it('debe crear o actualizar cliente en la base de datos', async () => {
    const clienteDto: Customer = {
      tipoIdentificacion: '05',
      identificacion: '1710034065',
      razonSocial: 'JUAN PEREZ',
      direccion: 'Quito',
      email: 'juan@gmail.com',
    };

    const singleMock = vi.fn().mockResolvedValueOnce({
      data: {
        id: 'cust-1',
        tipo_identificacion: '05',
        identificacion: '1710034065',
        razon_social: 'JUAN PEREZ',
      },
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
    mockClient.from.mockReturnValue({ upsert: upsertMock });

    const result = await service.crearOActualizar(clienteDto);

    expect(result.id).toBe('cust-1');
    expect(mockClient.from).toHaveBeenCalledWith('clientes');
  });
});
