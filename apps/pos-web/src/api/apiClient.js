const getBaseUrl = () => {
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL;
  return envUrl || 'http://localhost:3001/api';
};

const getApiKey = () => {
  const envKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_POS_API_KEY;
  return envKey || 'pharmastock-pos-secure-key-2026';
};

export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(endpoint, options = {}) {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();
  const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }

    if (!res.ok) {
      const errorMsg = data?.message || data?.error || `Error HTTP ${res.status}: ${res.statusText}`;
      throw new ApiError(errorMsg, res.status, data);
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Error de conexión con el servidor', 0, err);
  }
}

export const apiClient = {
  // Clientes
  buscarCliente: (identificacion) =>
    request(`/clientes/buscar?identificacion=${encodeURIComponent(identificacion)}`),
  
  crearCliente: (cliente) =>
    request('/clientes', { method: 'POST', body: JSON.stringify(cliente) }),

  // Ventas POS
  registrarVenta: (ventaPayload) =>
    request('/ventas', { method: 'POST', body: JSON.stringify(ventaPayload) }),

  obtenerVenta: (id) =>
    request(`/ventas/${id}`),

  // Facturación Electrónica SRI
  emitirFactura: (facturaPayload) =>
    request('/invoices/emitir', { method: 'POST', body: JSON.stringify(facturaPayload) }),

  obtenerEstadoFactura: (claveAcceso) =>
    request(`/invoices/${encodeURIComponent(claveAcceso)}/estado`),

  getRideUrl: (claveAcceso) => {
    const baseUrl = getBaseUrl().replace(/\/$/, '');
    const apiKey = getApiKey();
    return `${baseUrl}/invoices/${encodeURIComponent(claveAcceso)}/ride?apiKey=${encodeURIComponent(apiKey)}`;
  },

  getXmlUrl: (claveAcceso) => {
    const baseUrl = getBaseUrl().replace(/\/$/, '');
    const apiKey = getApiKey();
    return `${baseUrl}/invoices/${encodeURIComponent(claveAcceso)}/xml?apiKey=${encodeURIComponent(apiKey)}`;
  },
};
