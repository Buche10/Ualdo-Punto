import React, { useState, useEffect, useRef } from 'react';
import { Camera, Plus, Check, RefreshCw, Zap, Calendar, Package, AlertTriangle, Search, Volume2, ShieldAlert, Box, Pill, DollarSign, RotateCcw, Sliders, PackagePlus, Save } from 'lucide-react';
import { ScannerModal } from './ScannerModal';
import { playScanBeep, playWarningBeep, playSuccessChime } from '../utils/audio';
import { formatStockText } from '../data/mockPharmacyCatalog';
import { loadAuditLogs, saveAuditLogs } from '../utils/storage';

export const QuickCount = ({ products, batches, onUpdateCount, onResetSingleCount, onAddBatch, onAddNewProduct, isDarkMode }) => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Modos de conteo: 'detailed' (Lote+Fecha), 'burst' (+1 ráfaga)
  const [countMode, setCountMode] = useState('detailed');
  
  // Tipo de operación de conteo: 'add' (Sumar) o 'exact' (Establecer valor exacto)
  const [entryMethod, setEntryMethod] = useState('add');

  // Campos de cajas y unidades
  const [countBoxes, setCountBoxes] = useState(1);
  const [countLooseUnits, setCountLooseUnits] = useState(0);

  const [batchNumber, setBatchNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [countHistory, setCountHistory] = useState([]);
  const [unknownBarcode, setUnknownBarcode] = useState('');

  // Formulario de ALTA RÁPIDA (cuando el código escaneado no existe en el catálogo)
  const emptyNewProd = {
    name: '',
    activeIngredient: '',
    category: 'General',
    unitsPerBox: 1,
    boxPrice: '',
    unitPrice: '',
    initBoxes: 0,
    initLoose: 0,
    minStock: 5,
    location: '',
    batchNumber: '',
    expirationDate: ''
  };
  const [newProd, setNewProd] = useState(emptyNewProd);

  const searchInputRef = useRef(null);

  // Cargar historial persistente
  useEffect(() => {
    setCountHistory(loadAuditLogs());
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const handleBarcodeScanned = (scannedCode) => {
    setIsScannerOpen(false);
    setSearchQuery(scannedCode);

    const foundProduct = products.find(p => p.barcode === scannedCode);

    if (foundProduct) {
      playScanBeep();
      setSelectedProduct(foundProduct);
      
      setCountBoxes(1);
      setCountLooseUnits(0);

      if (countMode === 'burst') {
        const addedUnits = (foundProduct.unitsPerBox && foundProduct.unitsPerBox > 1) ? foundProduct.unitsPerBox : 1;
        executeCount(foundProduct, addedUnits, 1, 0, 'GENERAL', '', 'add');
      } else {
        const productBatches = batches.filter(b => b.productId === foundProduct.id);
        if (productBatches.length > 0) {
          setBatchNumber(productBatches[0].batchNumber || '');
          setExpirationDate(productBatches[0].expirationDate || '');
        } else {
          setBatchNumber('');
          setExpirationDate('');
        }
      }
    } else {
      playWarningBeep();
      setSelectedProduct(null);
      startNewProduct(scannedCode);
    }
  };

  // Abre el formulario de alta rápida con el código pre-cargado
  const startNewProduct = (code) => {
    setSelectedProduct(null);
    setUnknownBarcode(code);
    setNewProd(emptyNewProd);
  };

  const cancelNewProduct = () => {
    setUnknownBarcode('');
    setNewProd(emptyNewProd);
    setSearchQuery('');
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  // Crea el producto nuevo con la cantidad inicial como stock oficial del sistema
  const handleCreateProduct = (e) => {
    e.preventDefault();
    if (!newProd.name.trim()) {
      alert('Ingresa al menos el nombre del medicamento.');
      return;
    }

    const unitsPerBox = Math.max(1, parseInt(newProd.unitsPerBox) || 1);
    const boxPrice = parseFloat(newProd.boxPrice) || 0;
    const unitPrice = newProd.unitPrice !== ''
      ? parseFloat(newProd.unitPrice) || 0
      : Math.round(boxPrice / unitsPerBox);
    const initUnits = (parseInt(newProd.initBoxes) || 0) * unitsPerBox + (parseInt(newProd.initLoose) || 0);

    const product = {
      id: `prod-${Date.now()}`,
      barcode: unknownBarcode,
      name: newProd.name.trim(),
      activeIngredient: newProd.activeIngredient.trim() || newProd.name.trim(),
      presentation: `Caja x ${unitsPerBox}`,
      category: newProd.category.trim() || 'General',
      unitsPerBox,
      boxPrice,
      unitPrice,
      boxCost: 0,
      unitCost: 0,
      // La cantidad inicial ES el stock oficial (levantamiento desde cero)
      theoreticalStock: initUnits,
      countedStock: 0,
      isAudited: false,
      minStock: parseInt(newProd.minStock) || 0,
      location: newProd.location.trim()
    };

    onAddNewProduct(product);

    // Si se cargó lote/vencimiento, registrarlo también
    if (newProd.batchNumber.trim() || newProd.expirationDate) {
      onAddBatch({
        id: `batch-${Date.now()}`,
        productId: product.id,
        batchNumber: newProd.batchNumber.trim() || 'SIN_LOTE',
        expirationDate: newProd.expirationDate || new Date().toISOString().split('T')[0],
        quantity: initUnits
      });
    }

    playSuccessChime();

    // Limpiar y volver a enfocar para el siguiente escaneo
    setUnknownBarcode('');
    setNewProd(emptyNewProd);
    setSearchQuery('');
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setSearchQuery(product.barcode || product.name);
    setCountBoxes(1);
    setCountLooseUnits(0);

    const productBatches = batches.filter(b => b.productId === product.id);
    if (productBatches.length > 0) {
      setBatchNumber(productBatches[0].batchNumber || '');
      setExpirationDate(productBatches[0].expirationDate || '');
    } else {
      setBatchNumber('');
      setExpirationDate('');
    }
  };

  const handleRegisterCount = (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const unitsPerBox = selectedProduct.unitsPerBox || 1;
    const boxes = Math.max(0, parseInt(countBoxes) || 0);
    const loose = Math.max(0, parseInt(countLooseUnits) || 0);

    const totalUnitsInput = (boxes * unitsPerBox) + loose;

    executeCount(selectedProduct, totalUnitsInput, boxes, loose, batchNumber.trim() || 'SIN_LOTE', expirationDate, entryMethod);
  };

  const executeCount = (product, inputUnits, boxes, loose, batch, expDate, mode) => {
    // 1. Actualizar el stock del producto
    onUpdateCount(product.id, inputUnits, mode);

    // 2. Si se ingresó lote, registrar o actualizar
    if (batch && batch !== 'SIN_LOTE') {
      onAddBatch({
        id: `batch-${Date.now()}`,
        productId: product.id,
        batchNumber: batch,
        expirationDate: expDate || new Date().toISOString().split('T')[0],
        quantity: inputUnits
      });
    }

    // 3. Registrar entrada persistente en historial de auditoría
    const logItem = {
      id: Date.now(),
      productName: product.name,
      barcode: product.barcode,
      addedUnits: inputUnits,
      mode: mode,
      boxes: boxes,
      loose: loose,
      unitsPerBox: product.unitsPerBox || 1,
      batch: batch,
      expDate: expDate,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    const updatedHistory = [logItem, ...countHistory];
    setCountHistory(updatedHistory);
    saveAuditLogs(updatedHistory);
    playSuccessChime();

    // Resetear campos
    setCountBoxes(1);
    setCountLooseUnits(0);
    setSearchQuery('');
    setSelectedProduct(null);
    setBatchNumber('');
    setExpirationDate('');

    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleResetProductCount = (productId) => {
    if (window.confirm("¿Deseas corregir y reiniciar a 0 el conteo físico de este producto?")) {
      onResetSingleCount(productId);
      if (selectedProduct && selectedProduct.id === productId) {
        setSelectedProduct({ ...selectedProduct, countedStock: 0, isAudited: false });
      }
    }
  };

  const filteredProducts = searchQuery.trim() 
    ? products.filter(p => 
        p.barcode.includes(searchQuery.trim()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.activeIngredient.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const cardBg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-lg';
  const innerBg = isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300';
  const textTitle = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* Selector de Modo */}
      <div className={`${cardBg} border rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors`}>
        <div>
          <h2 className={`text-xl font-bold ${textTitle} flex items-center gap-2`}>
            <Package className="w-6 h-6 text-emerald-500" /> Conteo por Cajas y Unidades Sueltas
          </h2>
          <p className={`${textSub} text-xs mt-1`}>Escanea con la cámara del celular o usa tu lector USB de la farmacia</p>
        </div>

        <div className={`flex items-center gap-3 ${innerBg} p-1.5 rounded-xl border self-start md:self-auto`}>
          <button
            onClick={() => setCountMode('detailed')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              countMode === 'detailed'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/30'
                : textSub
            }`}
          >
            <Calendar className="w-4 h-4" /> Conteo Detallado
          </button>
          <button
            onClick={() => setCountMode('burst')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              countMode === 'burst'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                : textSub
            }`}
          >
            <Zap className="w-4 h-4" /> Ráfaga (+1 Caja Auto)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Panel Principal */}
        <div className="md:col-span-2 space-y-6">
          
          <div className={`${
            isDarkMode 
              ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border-emerald-500/30' 
              : 'bg-gradient-to-br from-white via-white to-emerald-50 border-emerald-200 shadow-md'
          } border rounded-2xl p-6 shadow-2xl relative overflow-hidden`}>
            
            <button
              onClick={() => setIsScannerOpen(true)}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-950/40 transition-all border border-emerald-400/30 group"
            >
              <div className="p-2 bg-white/10 rounded-xl group-hover:scale-110 transition-transform">
                <Camera className="w-7 h-7 text-white" />
              </div>
              ESCANEAR CÓDIGO CON EL CELULAR
            </button>

            <div className="mt-5 relative">
              <label className={`block text-xs font-semibold ${textSub} mb-2 flex items-center justify-between`}>
                <span>Buscar por Nombre o Código EAN-13:</span>
                <span className="text-slate-400 text-[11px] font-normal">Soporta Escáner USB</span>
              </label>
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Escanea o escribe aquí (ej. 779123... ó Ibuprofeno)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      e.preventDefault();
                      handleBarcodeScanned(searchQuery.trim());
                    }
                  }}
                  className={`w-full ${innerBg} ${textTitle} text-base rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400 shadow-inner`}
                />
              </div>
            </div>

            {/* Resultados filtrados */}
            {searchQuery.trim() && !selectedProduct && !unknownBarcode && (
              <div className={`mt-3 ${innerBg} border rounded-xl max-h-60 overflow-y-auto divide-y divide-slate-700/40 shadow-xl`}>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(prod => (
                    <button
                      key={prod.id}
                      onClick={() => handleSelectProduct(prod)}
                      className={`w-full text-left px-4 py-3 hover:bg-emerald-500/10 transition-colors flex items-center justify-between group`}
                    >
                      <div>
                        <div className={`font-semibold ${textTitle} group-hover:text-emerald-500 transition-colors`}>{prod.name}</div>
                        <div className={`text-xs ${textSub}`}>
                          {prod.activeIngredient} • {prod.unitsPerBox || 1} un/caja
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                          {prod.barcode}
                        </span>
                        <div className={`text-[11px] ${textSub} mt-0.5`}>
                          Caja: ${(prod.boxPrice || 0).toLocaleString()} | Unid: ${(prod.unitPrice || 0).toLocaleString()}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center space-y-3">
                    <p className={`${textSub} text-sm`}>No existe ningún producto con "{searchQuery.trim()}".</p>
                    <button
                      type="button"
                      onClick={() => startNewProduct(searchQuery.trim())}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/30"
                    >
                      <PackagePlus className="w-4 h-4" /> Crear producto con este código
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formulario de ALTA RÁPIDA (código no existente) */}
          {unknownBarcode && !selectedProduct && (
            <div className={`${cardBg} border-2 border-amber-500/50 rounded-2xl p-6 shadow-2xl animate-fade-in space-y-4`}>
              <div className="flex items-start justify-between border-b border-slate-700/50 pb-4">
                <div>
                  <span className="inline-block px-2.5 py-0.5 bg-amber-500/20 text-amber-500 text-xs font-bold rounded-md mb-2">
                    PRODUCTO NUEVO
                  </span>
                  <h3 className={`text-xl font-black ${textTitle} flex items-center gap-2`}>
                    <PackagePlus className="w-6 h-6 text-amber-500" /> Registrar para el inventario
                  </h3>
                  <p className={`text-xs ${textSub} mt-1`}>
                    Código: <span className="font-mono text-emerald-500">{unknownBarcode}</span>
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={`block text-xs font-bold ${textSub} mb-1`}>Nombre del medicamento (*):</label>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Ej. Ibuprofeno 600mg"
                      value={newProd.name}
                      onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                      className={`w-full ${innerBg} ${textTitle} text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={`block text-xs font-bold ${textSub} mb-1`}>Principio activo / categoría (opcional):</label>
                    <input
                      type="text"
                      placeholder="Ej. Ibuprofeno"
                      value={newProd.activeIngredient}
                      onChange={(e) => setNewProd({ ...newProd, activeIngredient: e.target.value })}
                      className={`w-full ${innerBg} ${textTitle} text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-bold ${textSub} mb-1`}>Unidades por caja:</label>
                    <input
                      type="number" min="1"
                      value={newProd.unitsPerBox}
                      onChange={(e) => setNewProd({ ...newProd, unitsPerBox: e.target.value })}
                      className={`w-full ${innerBg} ${textTitle} text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold ${textSub} mb-1`}>Precio caja completa ($):</label>
                    <input
                      type="number" min="0" step="any" inputMode="decimal"
                      placeholder="0"
                      value={newProd.boxPrice}
                      onChange={(e) => setNewProd({ ...newProd, boxPrice: e.target.value })}
                      className={`w-full ${innerBg} ${textTitle} text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold ${textSub} mb-1`}>Precio unidad suelta ($):</label>
                    <input
                      type="number" min="0" step="any" inputMode="decimal"
                      placeholder="auto"
                      value={newProd.unitPrice}
                      onChange={(e) => setNewProd({ ...newProd, unitPrice: e.target.value })}
                      className={`w-full ${innerBg} ${textTitle} text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold ${textSub} mb-1`}>Stock mínimo (alerta):</label>
                    <input
                      type="number" min="0"
                      value={newProd.minStock}
                      onChange={(e) => setNewProd({ ...newProd, minStock: e.target.value })}
                      className={`w-full ${innerBg} ${textTitle} text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500`}
                    />
                  </div>
                </div>

                {/* Stock inicial en góndola */}
                <div className={`${innerBg} border rounded-xl p-4`}>
                  <label className={`block text-xs font-bold ${textTitle} mb-2 flex items-center gap-1.5`}>
                    <Box className="w-4 h-4 text-emerald-500" /> ¿Cuánto hay ahora en la farmacia?
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className={`text-[11px] ${textSub}`}>Cajas completas</span>
                      <input
                        type="number" min="0"
                        value={newProd.initBoxes}
                        onChange={(e) => setNewProd({ ...newProd, initBoxes: e.target.value })}
                        className={`w-full ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} border border-slate-700 text-center font-black text-lg py-1.5 rounded-lg focus:outline-none focus:border-emerald-500`}
                      />
                    </div>
                    <div>
                      <span className={`text-[11px] ${textSub}`}>Unidades sueltas</span>
                      <input
                        type="number" min="0"
                        value={newProd.initLoose}
                        onChange={(e) => setNewProd({ ...newProd, initLoose: e.target.value })}
                        className={`w-full ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} border border-slate-700 text-center font-black text-lg py-1.5 rounded-lg focus:outline-none focus:border-emerald-500`}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-emerald-500 font-bold mt-2 text-center">
                    Stock inicial = {formatStockText(
                      (parseInt(newProd.initBoxes) || 0) * (parseInt(newProd.unitsPerBox) || 1) + (parseInt(newProd.initLoose) || 0),
                      parseInt(newProd.unitsPerBox) || 1
                    )}
                  </div>
                </div>

                {/* Lote y vencimiento (opcional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold ${textSub} mb-1`}>Nº de Lote (opcional):</label>
                    <input
                      type="text"
                      placeholder="Ej. LOT-2026-X"
                      value={newProd.batchNumber}
                      onChange={(e) => setNewProd({ ...newProd, batchNumber: e.target.value.toUpperCase() })}
                      className={`w-full ${innerBg} ${textTitle} text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 uppercase`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${textSub} mb-1`}>Vencimiento (opcional):</label>
                    <input
                      type="date"
                      value={newProd.expirationDate}
                      onChange={(e) => setNewProd({ ...newProd, expirationDate: e.target.value })}
                      className={`w-full ${innerBg} ${textTitle} text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500`}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 text-base transition-colors"
                  >
                    <Save className="w-5 h-5" /> GUARDAR Y SEGUIR ESCANEANDO
                  </button>
                  <button
                    type="button"
                    onClick={cancelNewProduct}
                    className={`px-5 py-3.5 ${innerBg} ${textSub} rounded-xl font-semibold text-sm`}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Formulario de Conteo del Producto Seleccionado */}
          {selectedProduct && (
            <div className={`${cardBg} border-2 border-emerald-500/50 rounded-2xl p-6 shadow-2xl animate-fade-in space-y-5`}>
              
              <div className="flex items-start justify-between border-b border-slate-700/50 pb-4">
                <div>
                  <span className="inline-block px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-md mb-2">
                    MEDICAMENTO SELECCIONADO
                  </span>
                  <h3 className={`text-2xl font-black ${textTitle}`}>{selectedProduct.name}</h3>
                  <p className={`text-xs ${textSub} mt-1`}>{selectedProduct.activeIngredient} • {selectedProduct.presentation}</p>
                </div>
                <div className="text-right">
                  <div className={`text-xs ${textSub}`}>Stock Físico Contado</div>
                  <div className="text-xl font-black text-emerald-500">
                    {formatStockText(selectedProduct.countedStock, selectedProduct.unitsPerBox)}
                  </div>
                  <div className={`text-[11px] ${textSub} mt-0.5`}>
                    Sistema: {formatStockText(selectedProduct.theoreticalStock, selectedProduct.unitsPerBox)}
                  </div>
                  
                  {/* Botón para resetear conteo de este producto */}
                  {selectedProduct.countedStock > 0 && (
                    <button
                      type="button"
                      onClick={() => handleResetProductCount(selectedProduct.id)}
                      className="mt-2 text-[11px] text-rose-500 hover:text-rose-400 underline font-semibold flex items-center justify-end gap-1 ml-auto"
                    >
                      <RotateCcw className="w-3 h-3" /> Corregir/Resetear a 0
                    </button>
                  )}
                </div>
              </div>

              {/* Precios */}
              <div className={`grid grid-cols-3 gap-3 ${innerBg} p-3.5 rounded-xl border text-xs`}>
                <div>
                  <span className={`${textSub} block text-[11px]`}>Unidades por Caja</span>
                  <span className={`font-bold ${textTitle} text-sm flex items-center gap-1`}>
                    <Box className="w-4 h-4 text-emerald-500" /> {selectedProduct.unitsPerBox || 1} un.
                  </span>
                </div>
                <div>
                  <span className={`${textSub} block text-[11px]`}>Precio Caja Completa</span>
                  <span className="font-bold text-emerald-500 text-sm">
                    ${(selectedProduct.boxPrice || 0).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className={`${textSub} block text-[11px]`}>Precio Unidad Suelta</span>
                  <span className="font-bold text-teal-400 text-sm">
                    ${(selectedProduct.unitPrice || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Selector de Modo de Conteo: Sumar vs Conteo Exacto */}
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className={textSub}>Modo de ingreso:</span>
                <button
                  type="button"
                  onClick={() => setEntryMethod('add')}
                  className={`px-3 py-1.5 rounded-lg border transition-all ${
                    entryMethod === 'add'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : `${innerBg} ${textSub}`
                  }`}
                >
                  Sumar al Conteo Actual (+)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMethod('exact')}
                  className={`px-3 py-1.5 rounded-lg border transition-all ${
                    entryMethod === 'exact'
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : `${innerBg} ${textSub}`
                  }`}
                >
                  Establecer Conteo Exacto (=)
                </button>
              </div>

              {/* Formulario de Cantidad por Caja y Unidad */}
              <form onSubmit={handleRegisterCount} className="space-y-4">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Cajas Completas */}
                  <div className={`${innerBg} p-4 rounded-xl border`}>
                    <label className={`block text-xs font-bold ${textTitle} mb-2 flex items-center gap-1.5`}>
                      <Box className="w-4 h-4 text-emerald-500" /> Cajas Completas:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCountBoxes(Math.max(0, countBoxes - 1))}
                        className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-lg"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={countBoxes}
                        onChange={(e) => setCountBoxes(parseInt(e.target.value) || 0)}
                        className={`w-full ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} border border-slate-700 text-center font-black text-xl py-1.5 rounded-lg focus:outline-none focus:border-emerald-500`}
                      />
                      <button
                        type="button"
                        onClick={() => setCountBoxes(countBoxes + 1)}
                        className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Unidades Sueltas */}
                  <div className={`${innerBg} p-4 rounded-xl border`}>
                    <label className={`block text-xs font-bold ${textTitle} mb-2 flex items-center gap-1.5`}>
                      <Pill className="w-4 h-4 text-teal-500" /> Unidades Sueltas / Blísteres:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCountLooseUnits(Math.max(0, countLooseUnits - 1))}
                        className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-lg"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={countLooseUnits}
                        onChange={(e) => setCountLooseUnits(parseInt(e.target.value) || 0)}
                        className={`w-full ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} border border-slate-700 text-center font-black text-xl py-1.5 rounded-lg focus:outline-none focus:border-emerald-500`}
                      />
                      <button
                        type="button"
                        onClick={() => setCountLooseUnits(countLooseUnits + 1)}
                        className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>

                </div>

                {/* Resumen Total */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-center justify-between text-xs">
                  <span className="text-emerald-500 font-semibold">
                    {entryMethod === 'exact' ? 'NUEVO TOTAL EXACTO A FIJAR:' : 'TOTAL A SUMAR AL CONTEO:'}
                  </span>
                  <span className="text-base font-black text-emerald-500">
                    {formatStockText((countBoxes * (selectedProduct.unitsPerBox || 1)) + countLooseUnits, selectedProduct.unitsPerBox)}
                  </span>
                </div>

                {/* Lote y Vencimiento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold ${textSub} mb-1`}>Número de Lote (Opcional):</label>
                    <input
                      type="text"
                      placeholder="Ej. LOT-2026-X"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
                      className={`w-full ${innerBg} ${textTitle} text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500 uppercase`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold ${textSub} mb-1`}>Fecha de Vencimiento:</label>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      className={`w-full ${innerBg} ${textTitle} text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500`}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 text-base transition-colors"
                  >
                    <Check className="w-5 h-5" /> CONFIRMAR Y REGISTRAR CONTEO
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className={`px-5 py-3.5 ${innerBg} ${textSub} rounded-xl font-semibold text-sm`}
                  >
                    Cancelar
                  </button>
                </div>

              </form>
            </div>
          )}

        </div>

        {/* Historial de Registro Persistente */}
        <div className={`${cardBg} border rounded-2xl p-5 shadow-xl flex flex-col h-full min-h-[400px]`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/50 mb-4">
            <h3 className={`font-bold ${textTitle} text-sm flex items-center gap-2`}>
              <RefreshCw className="w-4 h-4 text-emerald-500" /> Sesión de Conteo Persistente
            </h3>
            <span className={`text-xs ${innerBg} ${textSub} px-2 py-0.5 rounded-full font-mono`}>
              {countHistory.length} registros
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {countHistory.length > 0 ? (
              countHistory.map(item => (
                <div key={item.id} className={`${innerBg} border rounded-xl p-3 text-xs animate-fade-in`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className={`font-bold ${textTitle}`}>{item.productName}</div>
                      <div className={`${textSub} text-[11px] mt-0.5`}>
                        Lote: <span className="font-mono">{item.batch}</span> • {item.time}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-xs block">
                        {item.mode === 'exact' ? '=' : '+'}{formatStockText(item.addedUnits, item.unitsPerBox)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className={`h-full flex flex-col items-center justify-center text-center p-6 ${textSub}`}>
                <Package className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-xs">Aún no se han contado productos en esta sesión.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />
    </div>
  );
};
