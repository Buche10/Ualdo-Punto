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
    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3 text-xs`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-400">Forma de Pago</span>
        <select
          value={formaPago}
          onChange={(e) => setFormaPago(e.target.value)}
          className={`p-1.5 rounded-lg border text-xs font-semibold ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
          }`}
        >
          <option value="01">Efectivo (01)</option>
          <option value="16">Tarjeta Débito (16)</option>
          <option value="19">Tarjeta Crédito (19)</option>
          <option value="20">Transferencia / Otros (20)</option>
        </select>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-slate-800/60 font-mono">
        <div className="flex justify-between text-slate-400">
          <span>Subtotal 0% (Medicina)</span>
          <span>${totals.subtotal0.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Subtotal 15% (General)</span>
          <span>${totals.subtotal15.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Descuento</span>
          <span>-${totals.totalDescuento.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>IVA 15%</span>
          <span>${totals.totalIva.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-emerald-400 pt-2 border-t border-slate-800">
          <span>TOTAL A PAGAR</span>
          <span>${totals.importeTotal.toFixed(2)}</span>
        </div>
      </div>

      {excedeConsumidorFinal && (
        <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Normativa SRI: Ventas a Consumidor Final &gt; $50.00 requieren identificar al comprador con Cédula o RUC.</span>
        </div>
      )}

      <button
        type="button"
        disabled={cartEmpty || excedeConsumidorFinal || isProcessing}
        onClick={onEmitir}
        className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
          cartEmpty || excedeConsumidorFinal || isProcessing
            ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/50'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
        }`}
      >
        {isProcessing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Emitiendo Factura...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4" />
            <span>Emitir Factura Electrónica</span>
          </>
        )}
      </button>
    </div>
  );
};
