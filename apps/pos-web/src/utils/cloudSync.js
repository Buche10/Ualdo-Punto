import { apiClient } from '../api/apiClient';

// Capa de sincronizacion de inventario contra el backend NestJS (PostgreSQL).
// Las funciones llaman a los endpoints REST autenticados con la cookie de sesion.

// --- Lectura -------------------------------------------------------------

export const fetchProducts = async () => {
  const data = await apiClient.obtenerInventario();
  return data?.products || [];
};

export const fetchBatches = async () => {
  const data = await apiClient.obtenerInventario();
  return data?.batches || [];
};

export const fetchAll = async () => {
  const data = await apiClient.obtenerInventario();
  return {
    products: data?.products || [],
    batches: data?.batches || [],
  };
};

// --- Escritura de productos ---------------------------------------------

export const upsertProductCloud = async (product) => {
  if (!product) return;
  await apiClient.crearProducto(product);
};

export const upsertProductsCloud = async (products) => {
  if (!products || !products.length) return;
  await apiClient.guardarProductosLote(products);
};

export const deleteProductCloud = async (productId) => {
  if (!productId) return;
  await apiClient.eliminarProducto(productId);
};

// --- Escritura de lotes --------------------------------------------------

export const upsertBatchCloud = async (batch) => {
  if (!batch) return;
  await apiClient.crearLote(batch);
};

export const deleteBatchCloud = async (batchId) => {
  if (!batchId) return;
  await apiClient.eliminarLote(batchId);
};

// --- Reemplazo total (importar JSON / reiniciar catalogo) ----------------

export const replaceAllCloud = async (products = [], batches = []) => {
  await apiClient.reemplazarInventario({ products, batches });
};

// --- Sincronizacion periodica y foco -------------------------------------

// Reemplaza el realtime con refetch al recuperar foco/visibilidad y polling ligero
export const subscribeToChanges = (onChange) => {
  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      onChange();
    }
  };

  const handleWindowFocus = () => {
    onChange();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleWindowFocus);
  }
  const intervalId = setInterval(onChange, 45000);

  return () => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleWindowFocus);
    }
    clearInterval(intervalId);
  };
};
