import { supabase } from './supabaseClient';

// Capa de sincronización con Supabase.
//
// Modelo de datos: cada producto y cada lote se guardan como una fila con su
// `id` (texto) y el objeto completo en una columna JSONB `data`. Así no hay que
// mantener un mapeo campo-a-columna y el objeto viaja idéntico a como lo usa la
// app. Toda la lógica de filtrado/cálculo sigue ocurriendo en el cliente.

// --- Lectura -------------------------------------------------------------

export const fetchProducts = async () => {
  const { data, error } = await supabase.from('products').select('data');
  if (error) throw error;
  return (data || []).map((row) => row.data);
};

export const fetchBatches = async () => {
  const { data, error } = await supabase.from('batches').select('data');
  if (error) throw error;
  return (data || []).map((row) => row.data);
};

export const fetchAll = async () => {
  const [products, batches] = await Promise.all([fetchProducts(), fetchBatches()]);
  return { products, batches };
};

// --- Escritura de productos ---------------------------------------------

export const upsertProductCloud = async (product) => {
  const { error } = await supabase
    .from('products')
    .upsert({ id: product.id, data: product });
  if (error) throw error;
};

// Guarda de una vez una lista completa de productos (p. ej. tras un conteo múltiple)
export const upsertProductsCloud = async (products) => {
  if (!products.length) return;
  const rows = products.map((p) => ({ id: p.id, data: p }));
  const { error } = await supabase.from('products').upsert(rows);
  if (error) throw error;
};

export const deleteProductCloud = async (productId) => {
  // Borra el producto y, en cascada, sus lotes asociados
  const { error: pErr } = await supabase.from('products').delete().eq('id', productId);
  if (pErr) throw pErr;
  const { error: bErr } = await supabase.from('batches').delete().eq('product_id', productId);
  if (bErr) throw bErr;
};

// --- Escritura de lotes --------------------------------------------------

export const upsertBatchCloud = async (batch) => {
  const { error } = await supabase
    .from('batches')
    .upsert({ id: batch.id, product_id: batch.productId, data: batch });
  if (error) throw error;
};

export const deleteBatchCloud = async (batchId) => {
  const { error } = await supabase.from('batches').delete().eq('id', batchId);
  if (error) throw error;
};

// --- Reemplazo total (importar JSON / reiniciar demo) --------------------

export const replaceAllCloud = async (products, batches) => {
  // Vacía ambas tablas y vuelve a insertar el estado recibido.
  // El filtro `neq id ''` cumple el requisito de tener siempre una cláusula WHERE.
  const { error: delB } = await supabase.from('batches').delete().neq('id', '');
  if (delB) throw delB;
  const { error: delP } = await supabase.from('products').delete().neq('id', '');
  if (delP) throw delP;

  await upsertProductsCloud(products);
  if (batches.length) {
    const rows = batches.map((b) => ({ id: b.id, product_id: b.productId, data: b }));
    const { error } = await supabase.from('batches').insert(rows);
    if (error) throw error;
  }
};

// --- Tiempo real ---------------------------------------------------------

// Suscribe a cambios en ambas tablas. Ante cualquier cambio hecho por otro
// dispositivo, invoca `onChange()` para que la app recargue el estado.
// Devuelve una función para cancelar la suscripción.
export const subscribeToChanges = (onChange) => {
  const channel = supabase
    .channel('inventory-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
