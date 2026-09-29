import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle, ArrowLeftRight, Loader2 } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-lg p-6 rounded-3xl shadow-2xl border transition-all ${
          isDarkMode
            ? 'bg-[var(--surface)] border-[var(--border)] text-white'
            : 'bg-white border-[var(--border)] text-[var(--text)]'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">Emitir Nota de Crédito (Devolución)</h2>
              <p className="text-xs text-[var(--text-muted)]">Comprobante electrónico codDoc 04 ante el SRI</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {resultado ? (
          <div className="mt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-[var(--ualdo-aqua)]/10 border border-[var(--ualdo-aqua)]/30 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)] flex items-start gap-3">
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-[var(--ualdo-aqua)]" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm">Nota de Crédito Generada con Éxito</p>
                <p>Secuencial NC: <span className="font-mono font-bold">{resultado.secuencial}</span></p>
                <p>Factura Modificada: <span className="font-mono">{resultado.documentoModificado?.numDoc}</span></p>
                <p>Estado Fiscal: <span className="font-bold">{resultado.estado}</span></p>
                <p className="text-[11px] text-[var(--text-muted)] break-all">Clave Acceso: {resultado.claveAcceso}</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleReset}
                className="btn-pill-primary px-4 py-2 text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                Clave de Acceso de la Factura Original (49 dígitos) *
              </label>
              <input
                type="text"
                maxLength={49}
                value={claveAcceso}
                onChange={(e) => setClaveAcceso(e.target.value.replace(/\D/g, ''))}
                placeholder="Ej. 2809202601179001691900110010010000000011234567818"
                className={`w-full px-3 py-2 text-xs font-mono rounded-full border focus:outline-none focus:ring-2 focus:ring-[var(--ualdo-aqua)] ${
                  isDarkMode
                    ? 'bg-[var(--surface-muted)] border-[var(--border)] text-white'
                    : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text)]'
                }`}
                required
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Longitud actual: {claveAcceso.length} / 49
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                Motivo de la Devolución *
              </label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej. DEVOLUCIÓN DE MEDICAMENTO POR VENCIMIENTO"
                className={`w-full px-3 py-2 text-xs rounded-full border focus:outline-none focus:ring-2 focus:ring-[var(--ualdo-aqua)] ${
                  isDarkMode
                    ? 'bg-[var(--surface-muted)] border-[var(--border)] text-white'
                    : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text)]'
                }`}
                required
              />
            </div>

            <div className="p-3 rounded-2xl bg-[var(--surface-muted)] border border-[var(--border)] text-xs text-[var(--text-muted)] space-y-1">
              <p className="font-semibold text-[var(--text)]">Normativa SRI Ecuador:</p>
              <p>• La Nota de Crédito se vincula legalmente a la Factura (codDoc 01).</p>
              <p>• El stock del producto devuelto se reintegra automáticamente al inventario.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="btn-pill-secondary px-4 py-2 text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || claveAcceso.length !== 49}
                className="btn-pill-primary px-5 py-2.5 text-xs bg-rose-600 hover:bg-rose-500 text-white"
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
