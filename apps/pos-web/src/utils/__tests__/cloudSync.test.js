import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchProducts,
  fetchBatches,
  fetchAll,
  upsertProductCloud,
  upsertProductsCloud,
  deleteProductCloud,
  upsertBatchCloud,
  deleteBatchCloud,
  replaceAllCloud,
  subscribeToChanges,
} from '../cloudSync';
import { apiClient } from '../../api/apiClient';

vi.mock('../../api/apiClient', () => ({
  apiClient: {
    obtenerInventario: vi.fn(),
    crearProducto: vi.fn(),
    actualizarProducto: vi.fn(),
    eliminarProducto: vi.fn(),
    guardarProductosLote: vi.fn(),
    crearLote: vi.fn(),
    eliminarLote: vi.fn(),
    reemplazarInventario: vi.fn(),
  },
}));

describe('cloudSync (adaptador REST contra NestJS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetchProducts debe retornar la lista de productos devuelta por el backend', async () => {
    const mockData = {
      products: [{ id: 'p1', name: 'Paracetamol' }],
      batches: [{ id: 'b1', productId: 'p1' }],
    };
    vi.mocked(apiClient.obtenerInventario).mockResolvedValueOnce(mockData);

    const prods = await fetchProducts();
    expect(prods).toEqual([{ id: 'p1', name: 'Paracetamol' }]);
    expect(apiClient.obtenerInventario).toHaveBeenCalledTimes(1);
  });

  it('fetchBatches debe retornar la lista de lotes devuelta por el backend', async () => {
    const mockData = {
      products: [{ id: 'p1' }],
      batches: [{ id: 'b1', batchNumber: 'LOT-99' }],
    };
    vi.mocked(apiClient.obtenerInventario).mockResolvedValueOnce(mockData);

    const batches = await fetchBatches();
    expect(batches).toEqual([{ id: 'b1', batchNumber: 'LOT-99' }]);
  });

  it('fetchAll debe retornar products y batches de forma unificada', async () => {
    const mockData = {
      products: [{ id: 'p1' }],
      batches: [{ id: 'b1' }],
    };
    vi.mocked(apiClient.obtenerInventario).mockResolvedValueOnce(mockData);

    const res = await fetchAll();
    expect(res).toEqual(mockData);
  });

  it('upsertProductCloud debe invocar crearProducto con el payload adecuado', async () => {
    const prod = { id: 'p1', name: 'Ibuprofeno' };
    vi.mocked(apiClient.crearProducto).mockResolvedValueOnce(prod);

    await upsertProductCloud(prod);
    expect(apiClient.crearProducto).toHaveBeenCalledWith(prod);
  });

  it('upsertProductsCloud debe invocar guardarProductosLote si el arreglo no esta vacio', async () => {
    const list = [{ id: 'p1' }, { id: 'p2' }];
    vi.mocked(apiClient.guardarProductosLote).mockResolvedValueOnce(true);

    await upsertProductsCloud(list);
    expect(apiClient.guardarProductosLote).toHaveBeenCalledWith(list);

    // Arreglo vacio no debe llamar al api
    vi.clearAllMocks();
    await upsertProductsCloud([]);
    expect(apiClient.guardarProductosLote).not.toHaveBeenCalled();
  });

  it('deleteProductCloud debe invocar eliminarProducto', async () => {
    vi.mocked(apiClient.eliminarProducto).mockResolvedValueOnce(true);

    await deleteProductCloud('p1');
    expect(apiClient.eliminarProducto).toHaveBeenCalledWith('p1');
  });

  it('upsertBatchCloud y deleteBatchCloud deben invocar sus respectivos endpoints', async () => {
    const batch = { id: 'b1', productId: 'p1' };
    vi.mocked(apiClient.crearLote).mockResolvedValueOnce(batch);
    vi.mocked(apiClient.eliminarLote).mockResolvedValueOnce(true);

    await upsertBatchCloud(batch);
    expect(apiClient.crearLote).toHaveBeenCalledWith(batch);

    await deleteBatchCloud('b1');
    expect(apiClient.eliminarLote).toHaveBeenCalledWith('b1');
  });

  it('replaceAllCloud debe invocar reemplazarInventario con productos y lotes', async () => {
    const prods = [{ id: 'p1' }];
    const batches = [{ id: 'b1' }];
    vi.mocked(apiClient.reemplazarInventario).mockResolvedValueOnce({
      products: 1,
      batches: 1,
    });

    await replaceAllCloud(prods, batches);
    expect(apiClient.reemplazarInventario).toHaveBeenCalledWith({
      products: prods,
      batches,
    });
  });

  it('subscribeToChanges debe llamar callback en intervalo y visibilidad, y limpiar al desmontar', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeToChanges(onChange);

    // Avance de tiempo (45 segundos)
    vi.advanceTimersByTime(45000);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Evento de foco
    window.dispatchEvent(new Event('focus'));
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    vi.advanceTimersByTime(45000);
    window.dispatchEvent(new Event('focus'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
