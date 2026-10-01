import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from '../inventory.service';
import { NotFoundException } from '@nestjs/common';

describe('InventoryService (Persistencia de Inventario via PostgreSQL)', () => {
  let service: InventoryService;
  let mockDatabaseService: any;

  beforeEach(() => {
    mockDatabaseService = {
      query: vi.fn(),
      withTransaction: vi.fn(),
    };
    service = new InventoryService(mockDatabaseService);
  });

  describe('getInventory', () => {
    it('debe retornar products y batches mapeando la columna data de cada fila', async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce([{ data: { id: 'p1', name: 'Paracetamol' } }])
        .mockResolvedValueOnce([{ data: { id: 'b1', productId: 'p1', quantity: 10 } }]);

      const result = await service.getInventory();

      expect(result.products).toEqual([{ id: 'p1', name: 'Paracetamol' }]);
      expect(result.batches).toEqual([{ id: 'b1', productId: 'p1', quantity: 10 }]);
      expect(mockDatabaseService.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('createProduct', () => {
    it('debe insertar o actualizar el producto y retornar el objeto guardado', async () => {
      const prod = { id: 'p1', name: 'Amoxicilina', theoreticalStock: 20 };
      mockDatabaseService.query.mockResolvedValueOnce([{ data: prod }]);

      const result = await service.createProduct(prod as any);

      expect(result).toEqual(prod);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.products'),
        ['p1', JSON.stringify(prod)],
      );
    });
  });

  describe('updateProduct', () => {
    it('debe actualizar el producto existente', async () => {
      const prod = { id: 'p1', name: 'Amoxicilina 500mg' };
      mockDatabaseService.query.mockResolvedValueOnce([{ data: prod }]);

      const result = await service.updateProduct('p1', prod as any);
      expect(result).toEqual(prod);
    });

    it('debe lanzar NotFoundException si el producto no existe', async () => {
      mockDatabaseService.query.mockResolvedValueOnce([]);

      await expect(
        service.updateProduct('no-existe', { id: 'no-existe' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProduct', () => {
    it('debe eliminar en cascada lotes y producto dentro de una transaccion', async () => {
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rowCount: 2 }) // delete batches
          .mockResolvedValueOnce({ rowCount: 1 }), // delete product
      };
      mockDatabaseService.withTransaction.mockImplementation((fn: any) => fn(mockClient));

      const res = await service.deleteProduct('p1');
      expect(res).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.batches WHERE product_id = $1'),
        ['p1'],
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.products WHERE id = $1'),
        ['p1'],
      );
    });

    it('debe lanzar NotFoundException si el producto no existe al eliminar', async () => {
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rowCount: 0 })
          .mockResolvedValueOnce({ rowCount: 0 }),
      };
      mockDatabaseService.withTransaction.mockImplementation((fn: any) => fn(mockClient));

      await expect(service.deleteProduct('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBatch and deleteBatch', () => {
    it('debe crear un lote asociado a un producto', async () => {
      const batch = { id: 'b1', productId: 'p1', batchNumber: 'LOT-123', quantity: 50 };
      mockDatabaseService.query.mockResolvedValueOnce([{ data: batch }]);

      const res = await service.createBatch(batch as any);
      expect(res).toEqual(batch);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.batches'),
        ['b1', 'p1', JSON.stringify(batch)],
      );
    });

    it('debe eliminar un lote por id o lanzar NotFoundException si no existe', async () => {
      mockDatabaseService.query.mockResolvedValueOnce([{ id: 'b1' }]);
      const res = await service.deleteBatch('b1');
      expect(res).toBe(true);

      mockDatabaseService.query.mockResolvedValueOnce([]);
      await expect(service.deleteBatch('no-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('replaceInventory', () => {
    it('debe vaciar y reinsertar catalogo completo en una sola transaccion', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      mockDatabaseService.withTransaction.mockImplementation((fn: any) => fn(mockClient));

      const prods = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }];
      const batches = [{ id: 'b1', productId: 'p1', quantity: 10 }];

      const result = await service.replaceInventory(prods as any, batches as any);

      expect(result).toEqual({ products: 2, batches: 1 });
      expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM public.batches');
      expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM public.products');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.products'),
        expect.anything(),
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.batches'),
        expect.anything(),
      );
    });
  });
});
