import React from 'react';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { round2 } from '@pharmastock/shared';

export const CartTable = ({ items, onUpdateQuantity, onUpdateDiscount, onRemoveItem, onToggleIva, isDarkMode }) => {
  if (items.length === 0) {
    return (
      <div className={`p-8 text-center rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'} space-y-2`}>
        <ShoppingBag className="w-10 h-10 mx-auto text-slate-500 opacity-60" />
        <p className="font-bold text-sm text-slate-400">El carrito está vacío</p>
        <p className="text-xs text-slate-500">Escanea un código de barras o busca productos arriba para agregar a la venta.</p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-2xl border ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
      <table className="w-full text-left text-xs">
        <thead className={`border-b ${isDarkMode ? 'bg-slate-800/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'} uppercase text-[10px] font-bold`}>
          <tr>
            <th className="py-2.5 px-3">Producto</th>
            <th className="py-2.5 px-2 text-center">Cant.</th>
            <th className="py-2.5 px-2 text-right">P. Unit</th>
            <th className="py-2.5 px-2 text-center">Tarifa IVA</th>
            <th className="py-2.5 px-2 text-right">Desc.</th>
            <th className="py-2.5 px-3 text-right">Total</th>
            <th className="py-2.5 px-2 text-center"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {items.map((it) => {
            const bruto = it.cantidad * it.precioUnitario;
            const desc = it.descuento || 0;
            const neto = round2(Math.max(0, bruto - desc));
            const es15 = it.tarifaIva === 15;

            return (
              <tr key={it.productoId} className={isDarkMode ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}>
                <td className="py-2 px-3">
                  <div className="font-bold text-slate-200 dark:text-white leading-tight">{it.descripcion}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{it.codigo}</div>
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(it.productoId, it.cantidad - 1)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={it.cantidad}
                      onChange={(e) => onUpdateQuantity(it.productoId, parseFloat(e.target.value) || 1)}
                      className="w-10 text-center font-bold bg-transparent border-b border-slate-700 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(it.productoId, it.cantidad + 1)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-mono font-medium">
                  ${it.precioUnitario.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-center">
                  <button
                    type="button"
                    onClick={() => onToggleIva(it.productoId)}
                    title="Alternar tarifa IVA (0% medicina / 15% general)"
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] transition-all ${
                      es15
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {es15 ? '15%' : '0%'}
                  </button>
                </td>
                <td className="py-2 px-2 text-right">
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={it.descuento || 0}
                    onChange={(e) => onUpdateDiscount(it.productoId, parseFloat(e.target.value) || 0)}
                    className="w-14 text-right p-1 text-xs rounded bg-slate-800/80 border border-slate-700 text-slate-200"
                  />
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                  ${neto.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(it.productoId)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Quitar producto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
