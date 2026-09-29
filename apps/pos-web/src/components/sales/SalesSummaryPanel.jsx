import React from 'react';
import { AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

export const SalesSummaryPanel = ({
  formaPago,
  setFormaPago,
  totals,
  excedeConsumidorFinal,
  cartEmpty,
  isProcessing,
  onEmitir,
  isDarkMode,
}) => {
  return (
    <div className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-white border-[var(--border)]'} shadow-sm space-y-3 text-xs`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-[var(--text-muted)]">Forma de Pago</span>
        <select
          value={formaPago}
          onChange={(e) => setFormaPago(e.target.value)}
          className={`p-1.5 rounded-xl border text-xs font-semibold ${
            isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)] text-white' : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text)]'
          }`}
        >
          <option value="01">Efectivo (01)</option>
          <option value="16">Tarjeta Débito (16)</option>
          <option value="19">Tarjeta Crédito (19)</option>
          <option value="20">Transferencia / Otros (20)</option>
        </select>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-[var(--border)] font-mono">
        <div className="flex justify-between text-[var(--text-muted)]">
          <span>Subtotal 0% (Medicina)</span>
          <span>${totals.subtotal0.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[var(--text-muted)]">
          <span>Subtotal 15% (General)</span>
          <span>${totals.subtotal15.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[var(--text-muted)]">
          <span>Descuento</span>
          <span>-${totals.totalDescuento.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[var(--text-muted)]">
          <span>IVA 15%</span>
          <span>${totals.totalIva.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)] pt-2 border-t border-[var(--border)]">
          <span>TOTAL A PAGAR</span>
          <span>${totals.importeTotal.toFixed(2)}</span>
        </div>
      </div>

      {excedeConsumidorFinal && (
        <div className="p-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 text-[11px] flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Normativa SRI: Ventas a Consumidor Final &gt; $50.00 requieren identificar al comprador con Cédula o RUC.</span>
        </div>
      )}

      <button
        type="button"
        disabled={cartEmpty || excedeConsumidorFinal || isProcessing}
        onClick={onEmitir}
        className={`btn-pill-primary w-full py-3.5 text-sm ${
          cartEmpty || excedeConsumidorFinal || isProcessing
            ? 'opacity-50 cursor-not-allowed shadow-none'
            : ''
        }`}
      >
        {isProcessing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Emitiendo Factura...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4 text-[var(--ualdo-aqua)]" />
            <span>Emitir Factura Electrónica</span>
          </>
        )}
      </button>
    </div>
  );
};
