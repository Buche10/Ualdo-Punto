import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { App } from '../../App';

// Mock de storage y cloud sync para renderizar App de forma aislada
vi.mock('../../utils/storage', () => ({
  loadProducts: () => [],
  saveProducts: vi.fn(),
  loadBatches: () => [],
  saveBatches: vi.fn(),
  loadAuditLogs: () => [],
  saveAuditLogs: vi.fn(),
  resetInventoryToDefaults: () => ({ products: [], batches: [], auditLogs: [] }),
  exportInventoryJSON: () => '{}',
  importInventoryJSON: () => ({ success: true, products: [], batches: [], auditLogs: [] }),
}));

vi.mock('../../utils/supabaseClient', () => ({
  supabase: null,
  isCloudEnabled: false,
}));

vi.mock('../../utils/cloudSync', () => ({
  fetchAll: vi.fn().mockResolvedValue({ products: [], batches: [] }),
  upsertProductCloud: vi.fn(),
  upsertProductsCloud: vi.fn(),
  deleteProductCloud: vi.fn(),
  upsertBatchCloud: vi.fn(),
  deleteBatchCloud: vi.fn(),
  replaceAllCloud: vi.fn(),
  subscribeToChanges: () => () => {},
}));

describe('Brand Identity Verification', () => {
  it('renderiza la marca Ualdo Negocios en el header y no contiene PharmaStock', () => {
    const { container } = render(<App />);

    // 1. Logo oficial presente con su atributo alt correcto
    const logoImg = screen.getByAltText('Ualdo Negocios');
    expect(logoImg).toBeInTheDocument();
    expect(logoImg.tagName.toLowerCase()).toBe('img');

    // 2. Título de la marca en el header
    const brandTitle = screen.getByRole('heading', { level: 1 });
    expect(brandTitle).toHaveTextContent('Ualdo Negocios');

    // 3. El header no contiene "PharmaStock"
    const headerElement = container.querySelector('header');
    expect(headerElement).toBeInTheDocument();
    expect(headerElement.textContent.toLowerCase()).not.toContain('pharmastock');

    // 4. Todo el documento renderizado no tiene menciones visibles a "PharmaStock"
    expect(container.textContent.toLowerCase()).not.toContain('pharmastock');
  });
});
