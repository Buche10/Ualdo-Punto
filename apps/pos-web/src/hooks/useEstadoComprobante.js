import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/apiClient';

const TERMINAL_STATES = ['AUTORIZADO', 'DEVUELTA', 'NO_AUTORIZADO', 'ANULADO'];

export function useEstadoComprobante(claveAcceso, options = {}) {
  const { interval = 2000, maxAttempts = 20, enabled = false } = options;

  const [estado, setEstado] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  const attemptsRef = useRef(0);
  const timerRef = useRef(null);

  const checkStatus = useCallback(async (clave) => {
    if (!clave) return null;
    try {
      const response = await apiClient.obtenerEstadoFactura(clave);
      const payload = response?.data || response;
      setData(payload);
      setEstado(payload?.estado || null);
      return payload;
    } catch (err) {
      setError(err.message || 'Error al consultar estado');
      return null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const pollRef = useRef(null);

  const poll = useCallback(async (clave) => {
    if (!clave) return;

    attemptsRef.current += 1;
    const res = await checkStatus(clave);

    const currentStatus = res?.estado;
    const isTerminal = currentStatus && TERMINAL_STATES.includes(currentStatus);
    const reachedMax = attemptsRef.current >= maxAttempts;

    if (isTerminal || reachedMax) {
      stopPolling();
      setLoading(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      pollRef.current?.(clave);
    }, interval);
  }, [checkStatus, interval, maxAttempts, stopPolling]);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  const startPolling = useCallback((clave) => {
    const targetKey = clave || claveAcceso;
    if (!targetKey) return;

    stopPolling();
    attemptsRef.current = 0;
    setError(null);
    setLoading(true);
    setIsPolling(true);
    poll(targetKey);
  }, [claveAcceso, poll, stopPolling]);

  useEffect(() => {
    if (enabled && claveAcceso) {
      startPolling(claveAcceso);
    }
    return () => stopPolling();
  }, [claveAcceso, enabled, startPolling, stopPolling]);

  return {
    estado,
    data,
    loading,
    error,
    isPolling,
    startPolling,
    stopPolling,
    checkStatus,
  };
}
