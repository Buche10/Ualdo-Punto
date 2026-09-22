import { useState, useCallback } from 'react';
import { apiClient } from '../api/apiClient';

export function useEmitirFactura() {
  const [factura, setFactura] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const emitir = useCallback(async (facturaPayload) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.emitirFactura(facturaPayload);
      const data = response?.data || response;
      setFactura(data);
      return data;
    } catch (err) {
      setError(err.message || 'Error al emitir factura electrónica');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setFactura(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    factura,
    loading,
    error,
    emitir,
    reset,
  };
}
