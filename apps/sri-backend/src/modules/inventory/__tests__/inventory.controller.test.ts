import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryController } from '../inventory.controller';
import { ProductsController } from '../products.controller';
import { BatchesController } from '../batches.controller';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('Inventory Controllers (HTTP Endpoints & Guards)', () => {
  let inventoryController: InventoryController;
  let productsController: ProductsController;
  let batchesController: BatchesController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      getInventory: vi.fn().mockResolvedValue({ products: [], batches: [] }),
      replaceInventory: vi.fn().mockResolvedValue({ products: 5, batches: 2 }),
      createProduct: vi.fn().mockImplementation((p) => Promise.resolve(p)),
      updateProduct: vi.fn().mockImplementation((id, p) => Promise.resolve({ ...p, id })),
      deleteProduct: vi.fn().mockResolvedValue(true),
      upsertProductsBatch: vi.fn().mockResolvedValue(true),
      createBatch: vi.fn().mockImplementation((b) => Promise.resolve(b)),
      deleteBatch: vi.fn().mockResolvedValue(true),
    };

    inventoryController = new InventoryController(mockService);
    productsController = new ProductsController(mockService);
    batchesController = new BatchesController(mockService);
  });

  it('debe tener JwtAuthGuard configurado a nivel de cada controlador', () => {
    const guardsInv = Reflect.getMetadata(GUARDS_METADATA, InventoryController);
    const guardsProd = Reflect.getMetadata(GUARDS_METADATA, ProductsController);
    const guardsBatch = Reflect.getMetadata(GUARDS_METADATA, BatchesController);

    expect(guardsInv).toContain(JwtAuthGuard);
    expect(guardsProd).toContain(JwtAuthGuard);
    expect(guardsBatch).toContain(JwtAuthGuard);
  });

  it('GET /api/inventory debe retornar catalogo completo de productos y lotes', async () => {
    mockService.getInventory.mockResolvedValueOnce({
      products: [{ id: 'p1' }],
      batches: [{ id: 'b1' }],
    });

    const res = await inventoryController.getInventory();
    expect(res.products).toHaveLength(1);
    expect(res.batches).toHaveLength(1);
  });

  it('POST /api/inventory/replace debe invocar replaceInventory del servicio', async () => {
    const res = await inventoryController.replaceInventory({
      products: [{ id: 'p1' }],
      batches: [{ id: 'b1', productId: 'p1' }],
    });

    expect(res.success).toBe(true);
    expect(res.count).toEqual({ products: 5, batches: 2 });
    expect(mockService.replaceInventory).toHaveBeenCalledWith(
      [{ id: 'p1' }],
      [{ id: 'b1', productId: 'p1' }],
    );
  });

  it('ProductsController debe soportar create, update, delete y batch', async () => {
    const p = { id: 'p1', name: 'Prod' };
    const createRes = await productsController.createProduct(p);
    expect(createRes.success).toBe(true);
    expect(createRes.product).toEqual(p);

    const updateRes = await productsController.updateProduct('p1', p);
    expect(updateRes.success).toBe(true);
    expect(updateRes.product.id).toBe('p1');

    const deleteRes = await productsController.deleteProduct('p1');
    expect(deleteRes.success).toBe(true);
    expect(deleteRes.id).toBe('p1');

    const batchRes = await productsController.createProductsBatch({ products: [p] });
    expect(batchRes.success).toBe(true);
    expect(batchRes.count).toBe(1);
  });

  it('BatchesController debe soportar create y delete', async () => {
    const b = { id: 'b1', productId: 'p1', quantity: 10 };
    const createRes = await batchesController.createBatch(b);
    expect(createRes.success).toBe(true);
    expect(createRes.batch).toEqual(b);

    const deleteRes = await batchesController.deleteBatch('b1');
    expect(deleteRes.success).toBe(true);
    expect(deleteRes.id).toBe('b1');
  });
});
