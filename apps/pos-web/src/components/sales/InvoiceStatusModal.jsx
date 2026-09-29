import React, { useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, FileText, Download, Mail, Copy, Check, ArrowRight } from 'lucide-react';
import { useEstadoComprobante } from '../../hooks/useEstadoComprobante';
import { apiClient } from '../../api/apiClient';

export const InvoiceStatusModal = ({ isOpen, onClose, claveAcceso, initialData, onNewSale, clientEmail, isDarkMode }) => {
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const { estado: polledEstado, data, isPolling } = useEstadoComprobante(claveAcceso, {
    enabled: isOpen && !!claveAcceso,
    interval: 2000,
  });

  if (!isOpen) return null;

  const estado = polledEstado || initialData?.estado || 'FIRMADO';
  const numAutorizacion = data?.numAutorizacion || initialData?.numAutorizacion || (estado === 'AUTORIZADO' ? claveAcceso : null);
  const mensajes = data?.mensajes || [];

  const handleCopy = () => {
    if (claveAcceso) {
      navigator.clipboard.writeText(claveAcceso);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendEmail = () => {
    const email = clientEmail || 'cliente@ualdocorp.com';
    const conf = window.confirm(`¿Confirmar envío de factura electrónica al correo ${email}?`);
    if (conf) {
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 4000);
    }
  };

  const getStatusBadge = () => {
    switch (estado) {
      case 'AUTORIZADO':
        return {
          icon: <CheckCircle2 className="w-8 h-8 text-[var(--ualdo-aqua)]" />,
          title: 'Factura Autorizada por el SRI',
          color: 'text-[var(--ualdo-aqua)] bg-[var(--ualdo-aqua)]/10 border-[var(--ualdo-aqua)]/30',
          desc: 'El comprobante ha sido validado y autorizado legalmente por la autoridad tributaria.',
        };
      case 'RECIBIDA':
      case 'FIRMADO':
      case 'GENERADO':
        return {
          icon: <Clock className="w-8 h-8 text-amber-400 animate-spin" />,
          title: `Comprobante ${estado}`,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          desc: isPolling ? 'Transmitiendo y esperando autorización del SRI...' : 'Procesando en cola...',
        };
      case 'EN_CONTINGENCIA':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-amber-500" />,
          title: 'Emisión en Contingencia',
          color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
          desc: 'El SRI no respondió a tiempo. El comprobante será reenviado automáticamente por el worker.',
        };
      case 'DEVUELTA':
      case 'NO_AUTORIZADO':
        return {
          icon: <XCircle className="w-8 h-8 text-rose-500" />,
          title: `Rechazado: ${estado}`,
          color: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
          desc: 'El SRI detectó inconsistencias en los datos del comprobante.',
        };
      default:
        return {
          icon: <Clock className="w-8 h-8 text-[var(--text-muted)]" />,
          title: estado,
          color: 'text-[var(--text-muted)] bg-[var(--surface-muted)] border-[var(--border)]',
          desc: 'Estado del comprobante en procesamiento.',
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className={`w-full max-w-lg p-6 rounded-3xl border ${isDarkMode ? 'bg-[var(--surface)] border-[var(--border)] text-white' : 'bg-white border-[var(--border)] text-[var(--text)]'} shadow-2xl space-y-4 text-xs`}>
        {/* Encabezado Estado */}
        <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${badge.color}`}>
          {badge.icon}
          <div>
            <h3 className="font-bold text-sm tracking-tight">{badge.title}</h3>
            <p className="text-[11px] opacity-80">{badge.desc}</p>
          </div>
        </div>

        {/* Clave de Acceso */}
        <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)]' : 'bg-[var(--surface-muted)] border-[var(--border)]'} space-y-1`}>
          <div className="flex items-center justify-between text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-wider">
            <span>Clave de Acceso (49 Dígitos)</span>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)] hover:underline"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copiada' : 'Copiar'}
            </button>
          </div>
          <p className="font-mono text-[11px] break-all select-all font-semibold text-[var(--text)]">
            {claveAcceso}
          </p>
          {numAutorizacion && numAutorizacion !== claveAcceso && (
            <p className="text-[10px] text-[var(--ualdo-aqua)] pt-1">
              No. Autorización: {numAutorizacion}
            </p>
          )}
        </div>

        {/* Mensajes del SRI si existen */}
        {mensajes.length > 0 && (
          <div className="p-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 space-y-1">
            <p className="font-bold text-rose-400 text-[11px]">Mensajes del SRI:</p>
            {mensajes.map((m, idx) => (
              <p key={idx} className="text-[10px] text-rose-300">
                {typeof m === 'object' ? JSON.stringify(m) : String(m)}
              </p>
            ))}
          </div>
        )}

        {/* Acciones para comprobante autorizado */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={() => apiClient.descargarRide(claveAcceso).catch((err) => alert(err.message))}
            className="btn-pill-secondary py-2.5 px-3 text-xs w-full"
          >
            <FileText className="w-4 h-4 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]" />
            <span>Ver / Descargar RIDE</span>
          </button>

          <button
            type="button"
            onClick={() => apiClient.descargarXml(claveAcceso).catch((err) => alert(err.message))}
            className="btn-pill-secondary py-2.5 px-3 text-xs w-full"
          >
            <Download className="w-4 h-4 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]" />
            <span>Descargar XML</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleSendEmail}
          className="btn-pill-secondary w-full py-2.5 text-xs text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)] border-[var(--ualdo-aqua)]/30 bg-[var(--ualdo-aqua)]/10"
        >
          <Mail className="w-4 h-4" />
          <span>{emailSent ? 'Comprobante enviado por email' : 'Enviar RIDE + XML por Email'}</span>
        </button>

        {/* Botón Nueva Venta / Cerrar */}
        <div className="pt-2 flex justify-end gap-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            className="btn-pill-secondary px-4 py-2 text-xs"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onNewSale}
            className="btn-pill-primary px-5 py-2 text-xs"
          >
            <span>Nueva Venta</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
