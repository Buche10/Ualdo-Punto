import React, { useState } from 'react';
import { Package, AlertTriangle, DollarSign, Search, Plus, Edit2, CheckCircle2, ShieldAlert, FileText, ArrowUpDown, Tag, MapPin, Box, Pill, Trash2 } from 'lucide-react';
import { formatStockText } from '../data/mockPharmacyCatalog';

export const StockDashboard = ({ products, batches, onAddProduct, onEditProduct, onDeleteProduct, isDarkMode }) => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [newProd, setNewProd] = useState({
    name: '',
    barcode: '',
    activeIngredient: '',
    presentation: '',
    category: 'Analgésico / Antiinflamatorio',
    unitsPerBox: 20,
    boxPrice: 4500,
    unitPrice: 250,
    boxCost: 2800,
    unitCost: 140,
    theoreticalStock: 40,
    countedStock: 0,
    minStock: 10,
    location: 'Estante A-1'
  });

  const totalProductsCount = products.length;
  const countedProductsCount = products.filter(p => p.countedStock > 0 || p.isAudited).length;
  const countProgressPercent = totalProductsCount > 0 ? Math.round((countedProductsCount / totalProductsCount) * 100) : 0;
  
  const totalInventoryValueCost = products.reduce((acc, p) => acc + (p.theoreticalStock * (p.unitCost || (p.boxCost / (p.unitsPerBox || 1)) || 0)), 0);
  const totalInventoryValuePrice = products.reduce((acc, p) => acc + (p.theoreticalStock * (p.unitPrice || (p.boxPrice / (p.unitsPerBox || 1)) || 0)), 0);
  
  const lowStockProducts = products.filter(p => p.theoreticalStock <= p.minStock);

  const today = new Date();
  const expiringBatches = batches.filter(b => {
    const exp = new Date(b.expirationDate);
    const diffTime = exp - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  });

  const categories = ['ALL', ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search) ||
      p.activeIngredient.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase());

    const matchesCat = filterCategory === 'ALL' || p.category === filterCategory;

    let matchesStatus = true;
    if (filterStatus === 'LOW_STOCK') matchesStatus = p.theoreticalStock <= p.minStock;
    if (filterStatus === 'COUNTED') matchesStatus = p.countedStock > 0 || p.isAudited;
    if (filterStatus === 'UNCOUNTED') matchesStatus = !p.isAudited && p.countedStock === 0;

    return matchesSearch && matchesCat && matchesStatus;
  });

  const handleSaveNewProduct = (e) => {
    e.preventDefault();
    if (!newProd.name || !newProd.barcode) return;
    onAddProduct({
      ...newProd,
      id: `prod-${Date.now()}`,
      unitsPerBox: Number(newProd.unitsPerBox) || 1,
      boxPrice: Number(newProd.boxPrice) || 0,
      unitPrice: Number(newProd.unitPrice) || 0,
      boxCost: Number(newProd.boxCost) || 0,
      unitCost: Number(newProd.unitCost) || 0,
      theoreticalStock: Number(newProd.theoreticalStock) || 0,
      countedStock: Number(newProd.countedStock) || 0,
      minStock: Number(newProd.minStock) || 0,
      isAudited: false
    });
    setShowAddModal(false);
  };

  const handleSaveEditProduct = (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    onEditProduct({
      ...editingProduct,
      unitsPerBox: Number(editingProduct.unitsPerBox) || 1,
      boxPrice: Number(editingProduct.boxPrice) || 0,
      unitPrice: Number(editingProduct.unitPrice) || 0,
      boxCost: Number(editingProduct.boxCost) || 0,
      unitCost: Number(editingProduct.unitCost) || 0,
      theoreticalStock: Number(editingProduct.theoreticalStock) || 0,
      countedStock: Number(editingProduct.countedStock) || 0,
      minStock: Number(editingProduct.minStock) || 0
    });
    setEditingProduct(null);
  };

  const cardBg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md';
  const innerBg = isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300';
  const textTitle = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className={`${cardBg} border rounded-2xl p-5 shadow-xl`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${textSub} uppercase tracking-wider`}>Avance del Conteo</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className={`text-3xl font-black ${textTitle}`}>{countProgressPercent}%</div>
            <div className={`text-xs ${textSub} font-medium`}>{countedProductsCount} / {totalProductsCount} Ítems</div>
          </div>
          <div className={`w-full ${innerBg} rounded-full h-2 mt-3 overflow-hidden border`}>
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500 rounded-full"
              style={{ width: `${countProgressPercent}%` }}
            />
          </div>
        </div>

        <div className={`${cardBg} border rounded-2xl p-5 shadow-xl`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${textSub} uppercase tracking-wider`}>Valoración Inventario</span>
            <DollarSign className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-500">
              ${totalInventoryValueCost.toLocaleString()} <span className={`text-xs font-normal ${textSub}`}>(Costo)</span>
            </div>
            <div className={`text-xs ${textSub} mt-1`}>
              P. Venta: <span className={`font-semibold ${textTitle}`}>${totalInventoryValuePrice.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className={`${cardBg} border rounded-2xl p-5 shadow-xl`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${textSub} uppercase tracking-wider`}>Stock Crítico</span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-black text-amber-500">{lowStockProducts.length}</div>
            <div className={`text-xs ${textSub} font-medium`}>Ítems ≤ Mínimo</div>
          </div>
        </div>

        <div className={`${cardBg} border rounded-2xl p-5 shadow-xl`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${textSub} uppercase tracking-wider`}>Alerta Vencimientos</span>
            <ShieldAlert className="w-5 h-5 text-rose-500" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-3xl font-black text-rose-500">{expiringBatches.length}</div>
            <div className={`text-xs ${textSub} font-medium`}>Lotes en &lt;30 días</div>
          </div>
        </div>

      </div>

      {/* Controles */}
      <div className={`${cardBg} border rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-4`}>
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por medicamento, EAN, principio activo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full ${innerBg} ${textTitle} text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={`${innerBg} ${textTitle} text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-500`}
          >
            <option value="ALL">Todas las Categorías</option>
            {categories.filter(c => c !== 'ALL').map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/30 flex items-center gap-2 transition-colors ml-auto lg:ml-0"
          >
            <Plus className="w-4 h-4" /> Nuevo Producto
          </button>
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className={`${cardBg} border rounded-2xl shadow-xl overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-sm ${textSub}`}>
            <thead className={`${innerBg} border-b text-slate-400 uppercase text-[11px] font-bold tracking-wider`}>
              <tr>
                <th className="px-5 py-3.5">Medicamento</th>
                <th className="px-4 py-3.5">Código EAN-13</th>
                <th className="px-4 py-3.5 text-center">Unid/Caja</th>
                <th className="px-4 py-3.5 text-right">Precio Caja</th>
                <th className="px-4 py-3.5 text-right">Precio Unidad</th>
                <th className="px-4 py-3.5 text-center">Stock Sistema</th>
                <th className="px-4 py-3.5 text-center">Stock Contado</th>
                <th className="px-4 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {filteredProducts.length > 0 ? (
                filteredProducts.map(prod => (
                  <tr key={prod.id} className="hover:bg-emerald-500/5 transition-colors">
                    
                    <td className="px-5 py-4">
                      <div className={`font-bold ${textTitle} text-base`}>{prod.name}</div>
                      <div className={`text-xs ${textSub}`}>{prod.activeIngredient} • {prod.presentation}</div>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-mono text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded">
                        {prod.barcode}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className={`text-xs font-bold ${textTitle} ${innerBg} px-2.5 py-1 rounded-lg border`}>
                        {prod.unitsPerBox || 1} un.
                      </span>
                    </td>

                    <td className="px-4 py-4 text-right font-bold text-emerald-500">
                      ${(prod.boxPrice || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-4 text-right font-semibold text-teal-400">
                      ${(prod.unitPrice || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-4 text-center text-xs font-medium">
                      {formatStockText(prod.theoreticalStock, prod.unitsPerBox)}
                    </td>

                    <td className="px-4 py-4 text-center">
                      <span className={`font-bold text-xs px-2.5 py-1 rounded-lg ${
                        prod.countedStock > 0 || prod.isAudited
                          ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/30'
                          : `${textSub} ${innerBg}`
                      }`}>
                        {formatStockText(prod.countedStock, prod.unitsPerBox)}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-right flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingProduct({ ...prod })}
                        className={`p-2 ${textSub} hover:${textTitle} rounded-lg hover:bg-slate-700/50 transition-colors`}
                        title="Editar Medicamento Completo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onDeleteProduct(prod.id)}
                        className="p-2 text-rose-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Eliminar Medicamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-12 text-slate-400 text-sm">
                    No se encontraron medicamentos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar Producto Completo */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className={`${cardBg} border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6`}>
            <h3 className={`text-lg font-bold ${textTitle} mb-4`}>Editar Medicamento Completo</h3>
            <form onSubmit={handleSaveEditProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={`block font-semibold ${textSub} mb-1`}>Nombre Comercial:</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Código EAN-13:</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.barcode}
                    onChange={e => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Principio Activo:</label>
                  <input
                    type="text"
                    value={editingProduct.activeIngredient}
                    onChange={e => setEditingProduct({ ...editingProduct, activeIngredient: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Categoría:</label>
                  <input
                    type="text"
                    value={editingProduct.category}
                    onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Ubicación Estante:</label>
                  <input
                    type="text"
                    value={editingProduct.location}
                    onChange={e => setEditingProduct({ ...editingProduct, location: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Unidades por Caja:</label>
                  <input
                    type="number"
                    value={editingProduct.unitsPerBox}
                    onChange={e => setEditingProduct({ ...editingProduct, unitsPerBox: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Stock Mínimo Alerta:</label>
                  <input
                    type="number"
                    value={editingProduct.minStock}
                    onChange={e => setEditingProduct({ ...editingProduct, minStock: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Stock Sistema (Teórico):</label>
                  <input
                    type="number"
                    value={editingProduct.theoreticalStock}
                    onChange={e => setEditingProduct({ ...editingProduct, theoreticalStock: Number(e.target.value) })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Stock Contado Físico:</label>
                  <input
                    type="number"
                    value={editingProduct.countedStock}
                    onChange={e => setEditingProduct({ ...editingProduct, countedStock: Number(e.target.value), isAudited: true })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Precio Caja ($):</label>
                  <input
                    type="number" step="any" inputMode="decimal"
                    value={editingProduct.boxPrice}
                    onChange={e => setEditingProduct({ ...editingProduct, boxPrice: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Precio Unidad ($):</label>
                  <input
                    type="number" step="any" inputMode="decimal"
                    value={editingProduct.unitPrice}
                    onChange={e => setEditingProduct({ ...editingProduct, unitPrice: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-700">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                >
                  Actualizar Producto
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className={`px-4 py-2.5 ${innerBg} ${textSub} rounded-xl`}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Agregar Producto */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className={`${cardBg} border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6`}>
            <h3 className={`text-lg font-bold ${textTitle} mb-4`}>Registrar Nuevo Medicamento</h3>
            <form onSubmit={handleSaveNewProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={`block font-semibold ${textSub} mb-1`}>Nombre Comercial (*):</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Ibuprofeno 600mg"
                    value={newProd.name}
                    onChange={e => setNewProd({ ...newProd, name: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Código EAN-13 (*):</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 7791234567890"
                    value={newProd.barcode}
                    onChange={e => setNewProd({ ...newProd, barcode: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Unidades por Caja (*):</label>
                  <input
                    type="number"
                    required
                    value={newProd.unitsPerBox}
                    onChange={e => setNewProd({ ...newProd, unitsPerBox: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Precio Caja Completa ($):</label>
                  <input
                    type="number" step="any" inputMode="decimal"
                    value={newProd.boxPrice}
                    onChange={e => setNewProd({ ...newProd, boxPrice: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold ${textSub} mb-1`}>Precio Unidad Suelta ($):</label>
                  <input
                    type="number" step="any" inputMode="decimal"
                    value={newProd.unitPrice}
                    onChange={e => setNewProd({ ...newProd, unitPrice: e.target.value })}
                    className={`w-full ${innerBg} ${textTitle} rounded-xl p-2.5 border`}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-700">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                >
                  Guardar Medicamento
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
