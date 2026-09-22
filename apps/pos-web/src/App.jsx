import React, { useState, useEffect } from 'react';
import { Camera, Package, FileSpreadsheet, Calendar, Pill, RotateCcw, Smartphone, Sun, Moon, Download, Upload, Trash2, ReceiptText } from 'lucide-react';
import { QuickCount } from './components/QuickCount';
import { StockDashboard } from './components/StockDashboard';
import { AuditReport } from './components/AuditReport';
import { BatchManagement } from './components/BatchManagement';
import { SalesScreen } from './components/sales/SalesScreen';
import {
  loadProducts, saveProducts,
  loadBatches, saveBatches,
  loadAuditLogs, saveAuditLogs,
  resetInventoryToDefaults,
  exportInventoryJSON, importInventoryJSON
} from './utils/storage';
import { isCloudEnabled } from './utils/supabaseClient';
import {
  fetchAll,
  upsertProductCloud,
  upsertProductsCloud,
  deleteProductCloud,
  upsertBatchCloud,
  deleteBatchCloud,
  replaceAllCloud,
  subscribeToChanges
} from './utils/cloudSync';

export function App() {
  const [activeTab, setActiveTab] = useState('quick-count');
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  // Estado de la nube: 'local' (sin Supabase) | 'connecting' | 'online' | 'error'
  const [cloudStatus, setCloudStatus] = useState(isCloudEnabled ? 'connecting' : 'local');

  // Sincronizar clase 'dark' en documentElement para Tailwind
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Cargar datos: desde la nube (Supabase) si está configurada, o desde localStorage
  useEffect(() => {
    let unsubscribe = () => {};

    const init = async () => {
      // Los logs de auditoría permanecen locales (aún no se sincronizan)
      setAuditLogs(loadAuditLogs());

      if (!isCloudEnabled) {
        setProducts(loadProducts());
        setBatches(loadBatches());
        return;
      }

      try {
        // En modo nube se usa exactamente lo que haya en Supabase.
        // Si está vacío, la app arranca vacía para levantar el inventario real
        // escaneando (no se inyecta el catálogo de demostración).
        const { products: cloudProducts, batches: cloudBatches } = await fetchAll();

        setProducts(cloudProducts);
        setBatches(cloudBatches);
        saveProducts(cloudProducts); // caché local por si se pierde la conexión
        saveBatches(cloudBatches);
        setCloudStatus('online');

        // Escuchar cambios de otros dispositivos en tiempo real
        unsubscribe = subscribeToChanges(async () => {
          try {
            const fresh = await fetchAll();
            setProducts(fresh.products);
            setBatches(fresh.batches);
            saveProducts(fresh.products);
            saveBatches(fresh.batches);
          } catch (e) {
            console.error('Error al recargar desde la nube:', e);
          }
        });
      } catch (e) {
        console.error('No se pudo conectar a Supabase; se usan datos locales:', e);
        setProducts(loadProducts());
        setBatches(loadBatches());
        setCloudStatus('error');
      }
    };

    init();
    return () => unsubscribe();
  }, []);

  // Propaga una escritura a la nube (sin bloquear la UI). Marca error si falla.
  const pushToCloud = (fn) => {
    if (!isCloudEnabled) return;
    Promise.resolve()
      .then(fn)
      .catch((e) => {
        console.error('Error al sincronizar con la nube:', e);
        setCloudStatus('error');
      });
  };

  // Actualizar conteo (Modo acumulativo 'add' o conteo exacto 'exact')
  const handleUpdateCount = (productId, qty, mode = 'add') => {
    setProducts(prevProducts => {
      let changed = null;
      const updated = prevProducts.map(p => {
        if (p.id === productId) {
          const newCount = mode === 'exact' ? Math.max(0, qty) : (p.countedStock || 0) + qty;
          changed = {
            ...p,
            countedStock: newCount,
            isAudited: true // Marcar explícitamente como auditado en esta sesión
          };
          return changed;
        }
        return p;
      });
      saveProducts(updated);
      if (changed) pushToCloud(() => upsertProductCloud(changed));
      return updated;
    });
  };

  // Resetear/Corregir el conteo de un solo producto
  const handleResetSingleProductCount = (productId) => {
    setProducts(prev => {
      let changed = null;
      const updated = prev.map(p => {
        if (p.id === productId) {
          changed = { ...p, countedStock: 0, isAudited: false };
          return changed;
        }
        return p;
      });
      saveProducts(updated);
      if (changed) pushToCloud(() => upsertProductCloud(changed));
      return updated;
    });
  };

  const handleAddProduct = (newProd) => {
    setProducts(prev => {
      const updated = [newProd, ...prev];
      saveProducts(updated);
      return updated;
    });
    pushToCloud(() => upsertProductCloud(newProd));
  };

  const handleEditProduct = (updatedProd) => {
    setProducts(prev => {
      const updated = prev.map(p => p.id === updatedProd.id ? updatedProd : p);
      saveProducts(updated);
      return updated;
    });
    pushToCloud(() => upsertProductCloud(updatedProd));
  };

  const handleDeleteProduct = (productId) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este medicamento del catálogo?")) {
      setProducts(prev => {
        const updated = prev.filter(p => p.id !== productId);
        saveProducts(updated);
        return updated;
      });
      setBatches(prev => {
        const updated = prev.filter(b => b.productId !== productId);
        saveBatches(updated);
        return updated;
      });
      pushToCloud(() => deleteProductCloud(productId));
    }
  };

  const handleAddBatch = (newBatch) => {
    setBatches(prev => {
      // Si ya existe un lote con el mismo número para el mismo producto, sumar cantidad en lugar de duplicar
      const existingIndex = prev.findIndex(b => b.productId === newBatch.productId && b.batchNumber.toUpperCase() === newBatch.batchNumber.toUpperCase());

      let updated;
      let changed;
      if (existingIndex >= 0) {
        changed = {
          ...prev[existingIndex],
          quantity: prev[existingIndex].quantity + newBatch.quantity,
          expirationDate: newBatch.expirationDate || prev[existingIndex].expirationDate
        };
        updated = [...prev];
        updated[existingIndex] = changed;
      } else {
        changed = newBatch;
        updated = [newBatch, ...prev];
      }

      saveBatches(updated);
      pushToCloud(() => upsertBatchCloud(changed));
      return updated;
    });
  };

  const handleDeleteBatch = (batchId) => {
    if (window.confirm("¿Deseas eliminar este lote de medicamentos?")) {
      setBatches(prev => {
        const updated = prev.filter(b => b.id !== batchId);
        saveBatches(updated);
        return updated;
      });
      pushToCloud(() => deleteBatchCloud(batchId));
    }
  };

  // ¡FIX CRÍTICO!: Aplicar Ajuste de Auditoría
  // Todos los productos auditados (`isAudited === true`), incluso si fueron contados con 0 unidades por faltante/robo,
  // actualizarán su stock teórico oficial al stock contado.
  const handleApplyAuditAdjustment = () => {
    setProducts(prev => {
      const changed = [];
      const updated = prev.map(p => {
        if (p.isAudited) {
          const adjusted = {
            ...p,
            theoreticalStock: p.countedStock, // Se asigna directamente el stock contado (incluso si es 0)
            countedStock: 0,
            isAudited: false
          };
          changed.push(adjusted);
          return adjusted;
        }
        return p;
      });
      saveProducts(updated);
      if (changed.length) pushToCloud(() => upsertProductsCloud(changed));
      return updated;
    });
  };

  // Sincronización JSON (Exportar / Importar)
  const handleExportJSON = () => {
    const jsonStr = exportInventoryJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventario_Farmacia_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = importInventoryJSON(event.target.result);
      if (res.success) {
        setProducts(res.products);
        setBatches(res.batches);
        setAuditLogs(res.auditLogs);
        pushToCloud(() => replaceAllCloud(res.products, res.batches));
        alert("¡Inventario importado y sincronizado con éxito!");
      } else {
        alert("Error al importar el archivo de inventario: " + res.error);
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (window.confirm("¿Deseas reiniciar los datos al catálogo de prueba inicial? Esto limpiará la sesión actual.")) {
      const { products: defaultProds, batches: defaultBatches, auditLogs: defaultLogs } = resetInventoryToDefaults();
      setProducts(defaultProds);
      setBatches(defaultBatches);
      setAuditLogs(defaultLogs);
      pushToCloud(() => replaceAllCloud(defaultProds, defaultBatches));
    }
  };

  const handleSaleCompleted = (soldItems) => {
    setProducts((prev) => {
      const updated = prev.map((p) => {
        const sold = soldItems?.find((s) => s.productoId === p.id);
        if (sold) {
          const newStock = Math.max(0, (p.theoreticalStock ?? 0) - sold.cantidad);
          return { ...p, theoreticalStock: newStock };
        }
        return p;
      });
      saveProducts(updated);
      pushToCloud(() => upsertProductsCloud(updated));
      return updated;
    });
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans flex flex-col transition-colors duration-200`}>
      
      {/* Header Superior Adaptativo */}
      <header className={`${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200 shadow-sm'} sticky top-0 z-40 backdrop-blur-md border-b px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg transition-colors`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-xl text-white shadow-lg shadow-emerald-950/40">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`font-black text-lg sm:text-xl tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
              PharmaStock <span className="text-emerald-500 text-xs font-semibold px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">Express</span>
            </h1>
            <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>Sistema de Inventario para Farmacia y Control de Lotes</p>
          </div>
        </div>

        {/* Botones de Acción Header */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Indicador de estado de la nube */}
          <span
            title={
              cloudStatus === 'online' ? 'Sincronización en la nube activa'
              : cloudStatus === 'connecting' ? 'Conectando con la nube...'
              : cloudStatus === 'error' ? 'Sin conexión a la nube: trabajando con datos locales'
              : 'Modo local (sin sincronización configurada)'
            }
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border ${
              cloudStatus === 'online' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
              : cloudStatus === 'connecting' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
              : cloudStatus === 'error' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
              : isDarkMode ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-200 text-slate-500 border-slate-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              cloudStatus === 'online' ? 'bg-emerald-500 animate-pulse'
              : cloudStatus === 'connecting' ? 'bg-amber-500 animate-pulse'
              : cloudStatus === 'error' ? 'bg-rose-500'
              : 'bg-slate-400'
            }`} />
            {cloudStatus === 'online' ? 'Nube'
              : cloudStatus === 'connecting' ? 'Conectando'
              : cloudStatus === 'error' ? 'Sin conexión'
              : 'Local'}
          </span>

          <button
            onClick={handleExportJSON}
            title="Exportar inventario en JSON (para otro dispositivo)"
            className={`p-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors ${
              isDarkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span className="hidden md:inline">Exportar JSON</span>
          </button>

          <label
            title="Importar inventario desde JSON"
            className={`p-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors ${
              isDarkMode ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-500" />
            <span className="hidden md:inline">Importar</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            onClick={handleResetData}
            title="Reiniciar a catálogo de prueba"
            className={`p-2 text-xs rounded-xl flex items-center gap-1 transition-colors ${
              isDarkMode ? 'bg-slate-800/80 text-slate-400 hover:text-white' : 'bg-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-amber-500" />
            <span className="hidden md:inline">Reiniciar</span>
          </button>

          {/* Toggle Sol / Luna */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            className={`p-2 rounded-xl transition-colors ${
              isDarkMode ? 'bg-slate-800 text-amber-400 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-indigo-600" />}
          </button>
        </div>
      </header>

      {/* Contenido Principal con Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <aside className="hidden lg:block lg:col-span-3 space-y-2 sticky top-24 h-fit">
          <div className={`${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md'} border rounded-2xl p-3 shadow-xl space-y-1`}>
            <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Navegación Principal
            </div>

            <button
              onClick={() => setActiveTab('sales')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'sales'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                  : isDarkMode ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <ReceiptText className="w-5 h-5 text-emerald-400" />
              <span>Facturar (POS SRI)</span>
            </button>

            <button
              onClick={() => setActiveTab('quick-count')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'quick-count'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                  : isDarkMode ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Camera className="w-5 h-5 text-emerald-400" />
              <span>Conteo con Celular</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                  : isDarkMode ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Package className="w-5 h-5 text-emerald-400" />
              <span>Stock en Tiempo Real</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'audit'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                  : isDarkMode ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <span>Reporte Auditoría</span>
            </button>

            <button
              onClick={() => setActiveTab('batches')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'batches'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40'
                  : isDarkMode ? 'text-slate-400 hover:bg-slate-800/60 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-5 h-5 text-emerald-400" />
              <span>Lotes y Vencimientos</span>
            </button>
          </div>

          <div className={`${isDarkMode ? 'bg-slate-900/80 border-emerald-500/20' : 'bg-emerald-50/80 border-emerald-200'} border rounded-2xl p-4 text-xs space-y-2`}>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
              <Smartphone className="w-4 h-4" /> Escáner Móvil HTTPS
            </div>
            <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
              Compatible con la cámara de cualquier teléfono. Los conteos se persisten y puedes exportar la sesión en JSON para consolidar inventarios.
            </p>
          </div>
        </aside>

        <main className="lg:col-span-9">
          {activeTab === 'quick-count' && (
            <QuickCount
              products={products}
              batches={batches}
              onUpdateCount={handleUpdateCount}
              onResetSingleCount={handleResetSingleProductCount}
              onAddBatch={handleAddBatch}
              onAddNewProduct={handleAddProduct}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'dashboard' && (
            <StockDashboard
              products={products}
              batches={batches}
              onAddProduct={handleAddProduct}
              onEditProduct={handleEditProduct}
              onDeleteProduct={handleDeleteProduct}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'audit' && (
            <AuditReport
              products={products}
              onApplyAuditAdjustment={handleApplyAuditAdjustment}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'batches' && (
            <BatchManagement
              products={products}
              batches={batches}
              onAddBatch={handleAddBatch}
              onDeleteBatch={handleDeleteBatch}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === 'sales' && (
            <SalesScreen
              products={products}
              onSaleCompleted={handleSaleCompleted}
              isDarkMode={isDarkMode}
            />
          )}
        </main>

      </div>

      {/* Menú Móvil Inferior */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 ${
        isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xl'
      } backdrop-blur-lg border-t px-2 py-2 flex items-center justify-around`}>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'sales' ? 'text-emerald-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          <ReceiptText className="w-5 h-5" />
          <span>Facturar</span>
        </button>

        <button
          onClick={() => setActiveTab('quick-count')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'quick-count' ? 'text-emerald-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span>Conteo</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'dashboard' ? 'text-emerald-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          <Package className="w-5 h-5" />
          <span>Stock</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'audit' ? 'text-emerald-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span>Auditoría</span>
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'batches' ? 'text-emerald-500' : isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span>Lotes</span>
        </button>
      </nav>

    </div>
  );
}

export default App;
