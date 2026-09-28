import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, FileText, ArrowLeftRight, Loader2 } from 'lucide-react';
import { apiClient } from '../../api/apiClient';

export const DevolucionModal = ({ isOpen, onClose, isDarkMode }) => {
  const [claveAcceso, setClaveAcceso] = useState('');
  const [motivo, setMotivo] = useState('DEVOLUCIÓN DE MERCADERÍA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!claveAcceso.trim() || claveAcceso.trim().length !== 49) {
      setError('La clave de acceso de la factura debe tener exactamente 49 dígitos.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiClient.emitirNotaCredito({
        facturaClaveAcceso: claveAcceso.trim(),
        motivo: motivo.trim(),
      });
      setResultado(res.data || res);
    } catch (err) {
      setError(err.message || 'Error al emitir la Nota de Crédito.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setClaveAcceso('');
    setMotivo('DEVOLUCIÓN DE MERCADERÍA');
    setError(null);
    setResultado(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-lg p-6 rounded-2xl shadow-2xl border transition-all ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-700/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Emitir Nota de Crédito (Devolución)</h2>
              <p className="text-xs text-slate-400">Comprobante electrónico codDoc 04 ante el SRI</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {resultado ? (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm">Nota de Crédito Generada con Éxito</p>
                <p>Secuencial NC: <span className="font-mono font-bold text-white">{resultado.secuencial}</span></p>
                <p>Factura Modificada: <span className="font-mono">{resultado.documentoModificado?.numDoc}</span></p>
                <p>Estado Fiscal: <span className="font-bold">{resultado.estado}</span></p>
                <p className="text-[11px] text-slate-400 break-all">Clave Acceso: {resultado.claveAcceso}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Clave de Acceso de la Factura Original (49 dígitos) *
              </label>
              <input
                type="text"
                maxLength={49}
                value={claveAcceso}
                onChange={(e) => setClaveAcceso(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej. 2809202601179001691900110010010000000011234567818"
                className={`w-full px-3 py-2 text-xs font-mono rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                  isDarkMode
                    ? 'bg-slate-800/80 border-slate-700 text-white'
                    : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
                required
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Longitud actual: {claveAcceso.length} / 49
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Motivo de la Devolución *
              </label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. DEVOLUCIÓN DE MEDICAMENTO POR VENCIMIENTO"
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                  isDarkMode
                    ? 'bg-slate-800/80 border-slate-700 text-white'
                    : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
                required
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Normativa SRI Ecuador (Fase 5):</p>
              <p>• La Nota de Crédito se vincula legalmente a la Factura (codDoc 01).</p>
              <p>• El stock del producto devuelto se reintegra automáticamente al inventario.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || claveAcceso.length !== 49}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white transition shadow-lg shadow-rose-950/40"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Firmando y Emitiendo...</span>
                  </>
                ) : (
                  <span>Emitir Nota de Crédito</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
