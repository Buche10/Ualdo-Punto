import { INITIAL_PRODUCTS, INITIAL_BATCHES } from '../data/mockPharmacyCatalog';

const PRODUCTS_KEY = 'pharma_inventory_products';
const BATCHES_KEY = 'pharma_inventory_batches';
const AUDIT_LOG_KEY = 'pharma_inventory_audit_log';

export const loadProducts = () => {
  try {
    const data = localStorage.getItem(PRODUCTS_KEY);
    if (!data) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    const parsed = JSON.parse(data);
    
    return parsed.map(p => {
      const unitsPerBox = p.unitsPerBox || 1;
      const boxPrice = p.boxPrice !== undefined ? p.boxPrice : (p.price || 0);
      const unitPrice = p.unitPrice !== undefined ? p.unitPrice : Math.round((boxPrice / unitsPerBox) || 0);
      const boxCost = p.boxCost !== undefined ? p.boxCost : (p.cost || 0);
      const unitCost = p.unitCost !== undefined ? p.unitCost : Math.round((boxCost / unitsPerBox) || 0);

      return {
        ...p,
        unitsPerBox,
        boxPrice,
        unitPrice,
        boxCost,
        unitCost,
        countedStock: p.countedStock || 0,
        isAudited: p.isAudited || false
      };
    });
  } catch (e) {
    console.error("Error loading products:", e);
    return INITIAL_PRODUCTS;
  }
};

export const saveProducts = (products) => {
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  } catch (e) {
    console.error("Error saving products:", e);
  }
};

export const loadBatches = () => {
  try {
    const data = localStorage.getItem(BATCHES_KEY);
    if (!data) {
      localStorage.setItem(BATCHES_KEY, JSON.stringify(INITIAL_BATCHES));
      return INITIAL_BATCHES;
    }
    return JSON.parse(data);
  } catch (e) {
    console.error("Error loading batches:", e);
    return INITIAL_BATCHES;
  }
};

export const saveBatches = (batches) => {
  try {
    localStorage.setItem(BATCHES_KEY, JSON.stringify(batches));
  } catch (e) {
    console.error("Error saving batches:", e);
  }
};

export const loadAuditLogs = () => {
  try {
    const data = localStorage.getItem(AUDIT_LOG_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Error loading audit logs:", e);
    return [];
  }
};

export const saveAuditLogs = (logs) => {
  try {
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error("Error saving audit logs:", e);
  }
};

export const resetInventoryToDefaults = () => {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
  localStorage.setItem(BATCHES_KEY, JSON.stringify(INITIAL_BATCHES));
  localStorage.removeItem(AUDIT_LOG_KEY);
  return { products: INITIAL_PRODUCTS, batches: INITIAL_BATCHES, auditLogs: [] };
};

// Exportar e Importar estado completo en JSON para sincronizar varios celulares
export const exportInventoryJSON = () => {
  const products = loadProducts();
  const batches = loadBatches();
  const auditLogs = loadAuditLogs();

  const data = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    products,
    batches,
    auditLogs
  };

  return JSON.stringify(data, null, 2);
};

export const importInventoryJSON = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    if (data.products && Array.isArray(data.products)) {
      saveProducts(data.products);
    }
    if (data.batches && Array.isArray(data.batches)) {
      saveBatches(data.batches);
    }
    if (data.auditLogs && Array.isArray(data.auditLogs)) {
      saveAuditLogs(data.auditLogs);
    }
    return {
      success: true,
      products: data.products || [],
      batches: data.batches || [],
      auditLogs: data.auditLogs || []
    };
  } catch (e) {
    console.error("Error importing JSON:", e);
    return { success: false, error: e.message };
  }
};
