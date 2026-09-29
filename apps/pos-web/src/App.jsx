import React, { useState, useEffect } from 'react';
import { Camera, Package, FileSpreadsheet, Calendar, RotateCcw, Smartphone, Sun, Moon, Download, Upload, ReceiptText, LogOut } from 'lucide-react';
import { QuickCount } from './components/QuickCount';
import { StockDashboard } from './components/StockDashboard';
import { AuditReport } from './components/AuditReport';
import { BatchManagement } from './components/BatchManagement';
import { SalesScreen } from './components/sales/SalesScreen';
import { LoginScreen } from './components/auth/LoginScreen';
import { apiClient, setOnUnauthorized } from './api/apiClient';
import {
  loadProducts, saveProducts,
  loadBatches, saveBatches,
  loadAuditLogs,
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
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
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

  // Verificar sesion activa al cargar la aplicacion
  useEffect(() => {
    setOnUnauthorized(() => {
      setCurrentUser(null);
    });

    const checkSession = async () => {
      try {
        const res = await apiClient.obtenerUsuarioActual();
        if (res?.success && res?.user) {
          setCurrentUser(res.user);
        } else {
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkSession();
  }, []);

  // Cargar datos: desde la nube (Supabase) si hay sesion y esta configurada, o desde localStorage
  useEffect(() => {
    if (!currentUser) return;

    let unsubscribe = () => {};

    const init = async () => {
      setAuditLogs(loadAuditLogs());

      if (!isCloudEnabled) {
        setProducts(loadProducts());
        setBatches(loadBatches());
        return;
      }

      try {
        const { products: cloudProducts, batches: cloudBatches } = await fetchAll();

        setProducts(cloudProducts);
        setBatches(cloudBatches);
        saveProducts(cloudProducts);
        saveBatches(cloudBatches);
        setCloudStatus('online');

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
  }, [currentUser]);

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

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch (e) {
      console.error('Error al cerrar sesion:', e);
    } finally {
      setCurrentUser(null);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--ualdo-pizarra)] text-white font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-[var(--ualdo-aqua)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-300">Cargando sesion de Ualdo Negocios...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[var(--bg)] text-white' : 'bg-[var(--bg)] text-[var(--text)]'} font-sans flex flex-col transition-colors duration-200`}>
      
      {/* Header Superior Adaptativo */}
      <header className={`${isDarkMode ? 'bg-[var(--surface)]/95 border-[var(--border)]' : 'bg-white/95 border-[var(--border)] shadow-sm'} sticky top-0 z-40 backdrop-blur-md border-b px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg transition-colors`}>
        <div className="flex items-center gap-3">
          <img
            src={isDarkMode ? "/ualdo-logo-horizontal-fondo-oscuro.png" : "/ualdo-logo-horizontal-fondo-claro.png"}
            alt="Ualdo Negocios"
            className="h-8 sm:h-9 w-auto object-contain"
            width="140"
            height="36"
          />
          <div className="border-l border-[var(--border)] pl-3">
            <h1 className="font-bold text-sm sm:text-base tracking-tight text-[var(--text)] flex items-center gap-2">
              Ualdo Negocios
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--ualdo-petroleo)]/15 text-[var(--ualdo-petroleo)] dark:bg-[var(--ualdo-aqua)]/15 dark:text-[var(--ualdo-aqua)] border border-[var(--ualdo-aqua)]/30">
                POS
              </span>
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] hidden sm:block">
              {currentUser?.empresa?.nombre ? `Farmacia ${currentUser.empresa.nombre}` : 'Farmacia Valwis'}
            </p>
          </div>
        </div>

        {/* Botones de Accion Header */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Indicador de estado de la nube */}
          <span
            title={
              cloudStatus === 'online' ? 'Sincronización en la nube activa'
              : cloudStatus === 'connecting' ? 'Conectando con la nube...'
              : cloudStatus === 'error' ? 'Sin conexión a la nube: trabajando con datos locales'
              : 'Modo local (sin sincronización configurada)'
            }
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border ${
              cloudStatus === 'online' ? 'bg-[var(--ualdo-aqua)]/15 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)] border-[var(--ualdo-aqua)]/40'
              : cloudStatus === 'connecting' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
              : cloudStatus === 'error' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
              : 'bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              cloudStatus === 'online' ? 'bg-[var(--ualdo-aqua)] animate-pulse'
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
            className="btn-pill-secondary text-xs px-3 py-1.5"
          >
            <Download className="w-4 h-4 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]" />
            <span className="hidden md:inline">Exportar JSON</span>
          </button>

          <label
            title="Importar inventario desde JSON"
            className="btn-pill-secondary text-xs px-3 py-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]" />
            <span className="hidden md:inline">Importar</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            onClick={handleResetData}
            title="Reiniciar a catálogo de prueba"
            className="btn-pill-secondary text-xs px-3 py-1.5"
          >
            <RotateCcw className="w-4 h-4 text-amber-500" />
            <span className="hidden md:inline">Reiniciar</span>
          </button>

          {/* Toggle Sol / Luna */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            className="rounded-full p-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-[var(--ualdo-petroleo)]" />}
          </button>

          {/* Informacion de Usuario y Logout */}
          <div className="flex items-center gap-2 border-l border-[var(--border)] pl-2 sm:pl-3">
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs font-semibold text-[var(--text)]">
                {currentUser?.nombre || currentUser?.email}
              </span>
              <span className="text-[10px] text-[var(--ualdo-aqua)] font-medium">
                {currentUser?.empresa?.nombre || 'Valwis'} ({currentUser?.rol || 'operador'})
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesion"
              className="btn-pill-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar sesion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal con Sidebar */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <aside className="hidden lg:block lg:col-span-3 space-y-2 sticky top-24 h-fit">
          <div className={`${isDarkMode ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-white border-[var(--border)] shadow-md'} border rounded-3xl p-3 shadow-xl space-y-1`}>
            <div className="px-3 py-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Navegación Principal
            </div>

            <button
              onClick={() => setActiveTab('sales')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                activeTab === 'sales'
                  ? 'bg-[var(--ualdo-petroleo)] text-white shadow-lg shadow-[var(--ualdo-petroleo)]/30'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
              }`}
            >
              <ReceiptText className={`w-5 h-5 ${activeTab === 'sales' ? 'text-[var(--ualdo-aqua)]' : 'text-[var(--ualdo-turquesa)]'}`} />
              <span>Facturar (POS SRI)</span>
            </button>

            <button
              onClick={() => setActiveTab('quick-count')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                activeTab === 'quick-count'
                  ? 'bg-[var(--ualdo-petroleo)] text-white shadow-lg shadow-[var(--ualdo-petroleo)]/30'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Camera className={`w-5 h-5 ${activeTab === 'quick-count' ? 'text-[var(--ualdo-aqua)]' : 'text-[var(--ualdo-turquesa)]'}`} />
              <span>Conteo con Celular</span>
            </button>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-[var(--ualdo-petroleo)] text-white shadow-lg shadow-[var(--ualdo-petroleo)]/30'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Package className={`w-5 h-5 ${activeTab === 'dashboard' ? 'text-[var(--ualdo-aqua)]' : 'text-[var(--ualdo-turquesa)]'}`} />
              <span>Stock en Tiempo Real</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                activeTab === 'audit'
                  ? 'bg-[var(--ualdo-petroleo)] text-white shadow-lg shadow-[var(--ualdo-petroleo)]/30'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
              }`}
            >
              <FileSpreadsheet className={`w-5 h-5 ${activeTab === 'audit' ? 'text-[var(--ualdo-aqua)]' : 'text-[var(--ualdo-turquesa)]'}`} />
              <span>Reporte Auditoría</span>
            </button>

            <button
              onClick={() => setActiveTab('batches')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                activeTab === 'batches'
                  ? 'bg-[var(--ualdo-petroleo)] text-white shadow-lg shadow-[var(--ualdo-petroleo)]/30'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Calendar className={`w-5 h-5 ${activeTab === 'batches' ? 'text-[var(--ualdo-aqua)]' : 'text-[var(--ualdo-turquesa)]'}`} />
              <span>Lotes y Vencimientos</span>
            </button>
          </div>

          <div className={`${isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--ualdo-aqua)]/20' : 'bg-[var(--surface-muted)] border-[var(--border)]'} border rounded-3xl p-4 text-xs space-y-2`}>
            <div className="flex items-center gap-2 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)] font-bold">
              <Smartphone className="w-4 h-4" /> Escáner Móvil HTTPS
            </div>
            <p className="text-[var(--text-muted)] leading-relaxed">
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
        isDarkMode ? 'bg-[var(--surface)]/95 border-[var(--border)]' : 'bg-white/95 border-[var(--border)] shadow-xl'
      } backdrop-blur-lg border-t px-2 py-2 flex items-center justify-around`}>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'sales' ? 'text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <ReceiptText className="w-5 h-5" />
          <span>Facturar</span>
        </button>

        <button
          onClick={() => setActiveTab('quick-count')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'quick-count' ? 'text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Camera className="w-5 h-5" />
          <span>Conteo</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'dashboard' ? 'text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Package className="w-5 h-5" />
          <span>Stock</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'audit' ? 'text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <FileSpreadsheet className="w-5 h-5" />
          <span>Auditoría</span>
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'batches' ? 'text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
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
