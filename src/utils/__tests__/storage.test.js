import { describe, it, expect, beforeEach } from 'vitest';
import { loadProducts, saveProducts, exportInventoryJSON, importInventoryJSON } from '../storage';

describe('Storage and JSON Synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads default products when storage is empty', () => {
    const products = loadProducts();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toHaveProperty('unitsPerBox');
    expect(products[0]).toHaveProperty('boxPrice');
  });

  it('saves and reloads custom products', () => {
    const customProducts = [
      {
        id: 'test-1',
        barcode: '1234567890123',
        name: 'Test Med',
        activeIngredient: 'Test',
        theoreticalStock: 50,
        countedStock: 10,
        isAudited: true,
        unitsPerBox: 10,
        boxPrice: 1000,
        unitPrice: 100
      }
    ];

    saveProducts(customProducts);
    const loaded = loadProducts();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Test Med');
    expect(loaded[0].isAudited).toBe(true);
  });

  it('exports and imports JSON inventory data for multi-device sync', () => {
    const jsonStr = exportInventoryJSON();
    expect(jsonStr).toContain('version');
    expect(jsonStr).toContain('products');

    const result = importInventoryJSON(jsonStr);
    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
  });
});
