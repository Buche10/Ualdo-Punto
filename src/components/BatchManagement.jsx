import React, { useState } from 'react';
import { Calendar, ShieldAlert, AlertTriangle, CheckCircle, Plus, Search, Filter, Trash2 } from 'lucide-react';

export const BatchManagement = ({ products, batches, onAddBatch, onDeleteBatch, isDarkMode }) => {
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('ALL');
  const [showModal, setShowModal] = useState(false);

  const [newBatch, setNewBatch] = useState({
    productId: '',
    batchNumber: '',
    expirationDate: '',
    quantity: 10
  });

  const today = new Date();

  const batchesWithProducts = batches.map(batch => {
    const product = products.find(p => p.id === batch.productId) || { name: 'Producto Desconocido', barcode: 'N/A' };
    const expDate = new Date(batch.expirationDate);
    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status = 'OK';
    if (diffDays < 0) status = 'EXPIRED';
    else if (diffDays <= 30) status = 'URGENT';
    else if (diffDays <= 60) status = 'WARNING';

    return {
      ...batch,
      productName: product.name,
      barcode: product.barcode,
      activeIngredient: product.activeIngredient,
      diffDays,
      status
    };
  });

  batchesWithProducts.sort((a, b) => a.diffDays - b.diffDays);

  const filteredBatches = batchesWithProducts.filter(b => {
    const matchesSearch = 
      b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.productName.toLowerCase().includes(search.toLowerCase()) ||
      b.barcode.includes(search);

    let matchesFilter = true;
    if (filterState === 'EXPIRED') matchesFilter = b.status === 'EXPIRED';
    if (filterState === 'URGENT') matchesFilter = b.status === 'URGENT';
    if (filterState === 'WARNING') matchesFilter = b.status === 'WARNING';
    if (filterState === 'OK') matchesFilter = b.status === 'OK';

    return matchesSearch && matchesFilter;
  });

  const handleSaveBatch = (e) => {
    e.preventDefault();
    if (!newBatch.productId || !newBatch.batchNumber || !newBatch.expirationDate) return;

    onAddBatch({
      ...newBatch,
      id: `batch-${Date.now()}`,
      quantity: Number(newBatch.quantity)
    });

    setShowModal(false);
    setNewBatch({ productId: '', batchNumber: '', expirationDate: '', quantity: 10 });
  };

  const cardBg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md';
  const innerBg = isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300';
  const textTitle = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* Cabecera */}
      <div className={`${cardBg} border rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4`}>
        <div>
          <h2 className={`text-xl font-bold ${textTitle} flex items-center gap-2`}>
            <Calendar className="w-6 h-6 text-emerald-500" /> Control de Lotes y Vencimientos
          </h2>
          <p className={`${textSub} text-xs mt-1`}>Semáforo de caducidad para prevenir pérdidas por medicamentos vencidos</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/30 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Registrar Nuevo Lote
        </button>
      </div>

      {/* Filtros */}
      <div className={`${cardBg} border rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4`}>
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por lote, medicamento o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${innerBg} ${textTitle} text-xs rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-emerald-500`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setFilterState('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
              filterState === 'ALL' ? 'bg-emerald-600 text-white' : `${innerBg} ${textSub}`
            }`}
          >
            Todos ({batchesWithProducts.length})
          </button>
          <button
            onClick={() => setFilterState('EXPIRED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
              filterState === 'EXPIRED' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
            }`}
          >
            Vencidos ({batchesWithProducts.filter(b => b.status === 'EXPIRED').length})
          </button>
          <button
            onClick={() => setFilterState('URGENT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
              filterState === 'URGENT' ? 'bg-amber-600 text-white' : 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
            }`}
          >
            &lt; 30 días ({batchesWithProducts.filter(b => b.status === 'URGENT').length})
          </button>
          <button
            onClick={() => setFilterState('WARNING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
              filterState === 'WARNING' ? 'bg-yellow-600 text-white' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
            }`}
          >
            30-60 días ({batchesWithProducts.filter(b => b.status === 'WARNING').length})
          </button>
        </div>
      </div>

      {/* Grid de Lotes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBatches.length > 0 ? (
          filteredBatches.map(b => {
            let borderColor = isDarkMode ? 'border-slate-800' : 'border-slate-200';
            let badgeBg = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
            let statusText = `Vence en ${b.diffDays} días`;

            if (b.status === 'EXPIRED') {
              borderColor = 'border-rose-500/50';
              badgeBg = 'bg-rose-500/10 text-rose-500 border-rose-500/30';
              statusText = `VENCIDO HACE ${Math.abs(b.diffDays)} DÍAS`;
            } else if (b.status === 'URGENT') {
              borderColor = 'border-amber-500/50';
              badgeBg = 'bg-amber-500/10 text-amber-500 border-amber-500/30';
              statusText = `¡ALERTA! VENCE EN ${b.diffDays} DÍAS`;
            } else if (b.status === 'WARNING') {
              borderColor = 'border-yellow-500/40';
              badgeBg = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
              statusText = `Vence en ${b.diffDays} días`;
            }

            return (
              <div key={b.id} className={`${cardBg} border ${borderColor} rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`font-mono text-xs ${textTitle} ${innerBg} border px-2.5 py-1 rounded-lg font-bold`}>
                      {b.batchNumber}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeBg}`}>
                        {statusText}
                      </span>
                      
                      <button
                        onClick={() => onDeleteBatch(b.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Eliminar Lote"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h4 className={`font-bold ${textTitle} text-base leading-tight`}>{b.productName}</h4>
                  <p className={`text-xs ${textSub} mt-1`}>{b.activeIngredient}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center justify-between text-xs">
                  <div>
                    <span className={`${textSub} block text-[11px]`}>Fecha Caducidad</span>
                    <span className={`font-bold ${textTitle}`}>{b.expirationDate}</span>
                  </div>
                  <div className="text-right">
                    <span className={`${textSub} block text-[11px]`}>Cantidad en Lote</span>
                    <span className="font-extrabold text-emerald-500 text-sm">{b.quantity} un.</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className={`col-span-full py-12 text-center ${textSub} text-sm ${cardBg} border rounded-2xl`}>
            No hay lotes registrados para los filtros seleccionados.
          </div>
        )}
      </div>

      {/* Modal Agregar Lote */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className={`${cardBg} border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6`}>
            <h3 className={`text-lg font-bold ${textTitle} mb-4`}>Registrar Lote de Medicamento</h3>
            <form onSubmit={handleSaveBatch} className="space-y-4 text-xs">
              <div>
                <label className={`block font-semibold ${textSub} mb-1`}>Seleccionar Medicamento (*):</label>
                <select
                  required
                  value={newBatch.productId}
                  onChange={e => setNewBatch({ ...newBatch, productId: e.target.value })}
                  className={`w-full ${innerBg} ${textTitle} border rounded-xl p-2.5`}
                >
                  <option value="">-- Elige un medicamento --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.barcode})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block font-semibold ${textSub} mb-1`}>Número / Código de Lote (*):</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. LOT-2026-B"
                  value={newBatch.batchNumber}
                  onChange={e => setNewBatch({ ...newBatch, batchNumber: e.target.value.toUpperCase() })}
                  className={`w-full ${innerBg} ${textTitle} border rounded-xl p-2.5 uppercase`}
                />
              </div>

              <div>
                <label className={`block font-semibold ${textSub} mb-1`}>Fecha de Vencimiento (*):</label>
                <input
                  type="date"
                  required
                  value={newBatch.expirationDate}
                  onChange={e => setNewBatch({ ...newBatch, expirationDate: e.target.value })}
                  className={`w-full ${innerBg} ${textTitle} border rounded-xl p-2.5`}
                />
              </div>

              <div>
                <label className={`block font-semibold ${textSub} mb-1`}>Cantidad en este Lote:</label>
                <input
                  type="number"
                  min="1"
                  value={newBatch.quantity}
                  onChange={e => setNewBatch({ ...newBatch, quantity: e.target.value })}
                  className={`w-full ${innerBg} ${textTitle} border rounded-xl p-2.5`}
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-700">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                >
                  Guardar Lote
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={`px-4 py-2.5 ${innerBg} ${textSub} rounded-xl`}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
