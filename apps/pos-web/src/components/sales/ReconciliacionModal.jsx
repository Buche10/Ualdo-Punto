import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, AlertTriangle, CheckCircle2, Clock, ShieldAlert, ArrowRight } from 'lucide-react';
import { apiClient } from '../../api/apiClient';

export const ReconciliacionModal = ({ isOpen, onClose, isDarkMode }) => {
  const [ventasPendientes, setVentasPendientes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const cargarVentasPendientes = useCallback(async (limpiarFeedback = true) => {
    setIsLoading(true);
    if (limpiarFeedback) setFeedback(null);
    try {
      const res = await apiClient.obtenerVentasPendientesFacturacion();
      const items = res?.data || res || [];
      setVentasPendientes(Array.isArray(items) ? items : []);
    } catch (err) {
      setFeedback({ tipo: 'error', mensaje: err.message || 'Error al consultar ventas pendientes.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      cargarVentasPendientes(true);
    }
  }, [isOpen, cargarVentasPendientes]);

  if (!isOpen) return null;

  const handleReemitir = async (ventaId) => {
    setProcessingId(ventaId);
    try {
      const res = await apiClient.reemitirFacturaVenta(ventaId);
      const data = res?.data || res;
      setFeedback({
        tipo: 'exito',
        mensaje: data?.mensaje || `Venta re-emitida exitosamente. Clave: ${data?.claveAcceso || ''}`,
      });
      // Recargar lista después de re-emisión preservando feedback
      await cargarVentasPendientes(false);
    } catch (err) {
      setFeedback({
        tipo: 'error',
        mensaje: err.message || 'No se pudo re-emitir la factura.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getBadgeClass = (motivo) => {
    switch (motivo) {
      case 'EN_CONTINGENCIA':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      case 'DEVUELTA':
      case 'NO_AUTORIZADO':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/30';
      case 'SIN_COMPROBANTE':
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className={`w-full max-w-4xl p-6 rounded-2xl shadow-2xl border transition-all max-h-[85vh] flex flex-col ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-white'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-700/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Reconciliación de Comprobantes SRI</h2>
              <p className="text-xs text-slate-400">
                Ventas pendientes de facturación o en contingencia ante el SRI
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cargarVentasPendientes}
              disabled={isLoading}
              className={`p-2 rounded-xl border transition ${
                isDarkMode
                  ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
              title="Actualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback visual */}
        {feedback && (
          <div
            className={`my-3 p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
              feedback.tipo === 'exito'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {feedback.tipo === 'exito' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.mensaje}</span>
          </div>
        )}

        {/* Lista de ventas */}
        <div className="flex-1 overflow-y-auto my-4 space-y-2">
          {isLoading && ventasPendientes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
              <span>Cargando ventas pendientes...</span>
            </div>
          ) : ventasPendientes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <span className="font-semibold text-emerald-400">Todo al día</span>
              <span>No existen ventas pendientes ni comprobantes en contingencia.</span>
            </div>
          ) : (
            ventasPendientes.map((v) => {
              const isProcessingThis = processingId === v.ventaId;
              const fechaStr = v.fecha ? new Date(v.fecha).toLocaleString() : 'N/A';
              const clienteNombre = v.cliente?.razon_social || v.cliente?.identificacion || 'Consumidor Final';

              return (
                <div
                  key={v.ventaId}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                    isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{clienteNombre}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeClass(v.motivo)}`}>
                        {v.motivo || 'PENDIENTE'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {fechaStr}
                      </span>
                      <span>Total: <strong className="text-emerald-400 font-mono">${Number(v.importeTotal || 0).toFixed(2)}</strong></span>
                      {v.comprobante?.secuencial && (
                        <span>Sec: <code className="text-slate-300">{v.comprobante.secuencial}</code></span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleReemitir(v.ventaId)}
                    disabled={isProcessingThis || processingId !== null}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 disabled:opacity-50 transition shadow-sm"
                  >
                    {isProcessingThis ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Re-emitiendo...</span>
                      </>
                    ) : (
                      <>
                        <span>Re-emitir Factura</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Pie */}
        <div className="pt-3 border-t border-slate-700/40 flex justify-between items-center text-xs text-slate-400">
          <span>{ventasPendientes.length} registro(s) pendiente(s)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
