import { useState, useCallback } from 'react';
import { apiClient } from '../api/apiClient';

export function useClientes() {
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const buscar = useCallback(async (identificacion) => {
    if (!identificacion || identificacion.trim().length < 3) {
      setCliente(null);
      setError(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.buscarCliente(identificacion.trim());
      const data = response?.data || null;
      setCliente(data);
      return data;
    } catch (err) {
      setError(err.message || 'Error al buscar cliente');
      setCliente(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const crear = useCallback(async (clienteData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.crearCliente(clienteData);
      const data = response?.data || null;
      setCliente(data);
      return data;
    } catch (err) {
      setError(err.message || 'Error al guardar cliente');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setCliente(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    cliente,
    setCliente,
    loading,
    error,
    buscar,
    crear,
    reset,
  };
}
