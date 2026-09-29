import React from 'react';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { round2 } from '@pharmastock/shared';

export const CartTable = ({ items, onUpdateQuantity, onUpdateDiscount, onRemoveItem, onToggleIva, isDarkMode }) => {
  if (items.length === 0) {
    return (
      <div className={`p-8 text-center rounded-3xl border ${isDarkMode ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-white border-[var(--border)]'} space-y-2`}>
        <img
          src="/ualdo-mascota.png"
          alt="UALDO, asistente de Ualdo"
          className="w-16 h-16 object-contain mx-auto mb-2 opacity-85"
          width="64"
          height="64"
        />
        <p className="font-bold text-sm text-[var(--text)]">Tu carrito está vacío</p>
        <p className="text-xs text-[var(--text-muted)]">Escanea un código de barras o busca productos arriba para agregar a la venta.</p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-3xl border ${isDarkMode ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-white border-[var(--border)]'} shadow-sm`}>
      <table className="w-full text-left text-xs">
        <thead className={`border-b ${isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text-muted)]' : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text-muted)]'} uppercase text-[10px] font-bold`}>
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
        <tbody className="divide-y divide-[var(--border)]">
          {items.map((it) => {
            const bruto = it.cantidad * it.precioUnitario;
            const desc = it.descuento || 0;
            const neto = round2(Math.max(0, bruto - desc));
            const es15 = it.tarifaIva === 15;

            return (
              <tr key={it.productoId} className={isDarkMode ? 'hover:bg-[var(--surface-muted)]/50' : 'hover:bg-[var(--surface-muted)]/50'}>
                <td className="py-2 px-3">
                  <div className="font-bold text-[var(--text)] leading-tight">{it.descripcion}</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono">{it.codigo}</div>
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(it.productoId, it.cantidad - 1)}
                      className="p-1 rounded-full bg-[var(--surface-muted)] hover:bg-[var(--ualdo-aqua)]/20 text-[var(--text)] transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={it.cantidad}
                      onChange={(e) => onUpdateQuantity(it.productoId, parseFloat(e.target.value) || 1)}
                      className="w-10 text-center font-bold bg-transparent border-b border-[var(--border)] text-[var(--text)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(it.productoId, it.cantidad + 1)}
                      className="p-1 rounded-full bg-[var(--surface-muted)] hover:bg-[var(--ualdo-aqua)]/20 text-[var(--text)] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-mono font-medium text-[var(--text)]">
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
                        : 'bg-[var(--ualdo-aqua)]/20 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)] border border-[var(--ualdo-aqua)]/30'
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
                    className="w-14 text-right p-1 text-xs rounded-lg bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text)]"
                  />
                </td>
                <td className="py-2 px-3 text-right font-mono font-bold text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]">
                  ${neto.toFixed(2)}
                </td>
                <td className="py-2 px-2 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(it.productoId)}
                    className="p-1 text-[var(--text-muted)] hover:text-rose-500 transition-colors"
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
