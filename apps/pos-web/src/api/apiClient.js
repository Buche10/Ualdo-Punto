export const getBaseUrl = () => {
  const envUrl = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_BACKEND_URL || import.meta.env?.VITE_API_URL)
    : undefined;
  if (!envUrl || envUrl.trim() === '' || envUrl === '/api') {
    return '/api';
  }
  return envUrl;
};

export class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let onUnauthorizedHandler = null;

export const setOnUnauthorized = (handler) => {
  onUnauthorizedHandler = handler;
};

async function request(endpoint, options = {}) {
  const baseUrl = getBaseUrl();
  const cleanEndpoint = endpoint.replace(/^\//, '');
  const url = `${baseUrl.replace(/\/$/, '')}/${cleanEndpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }

    if (!res.ok) {
      if (res.status === 401 && !cleanEndpoint.startsWith('auth/login') && !cleanEndpoint.startsWith('auth/me')) {
        if (typeof onUnauthorizedHandler === 'function') {
          onUnauthorizedHandler();
        }
      }
      const errorMsg = data?.message || data?.error || `Error HTTP ${res.status}: ${res.statusText}`;
      throw new ApiError(errorMsg, res.status, data);
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Error de conexion con el servidor', 0, err);
  }
}

export const apiClient = {
  // Autenticacion Ualdo Negocios
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request('/auth/logout', {
      method: 'POST',
    }),

  obtenerUsuarioActual: () =>
    request('/auth/me'),

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

  // Facturacion Electronica SRI
  emitirFactura: (facturaPayload) =>
    request('/invoices/emitir', { method: 'POST', body: JSON.stringify(facturaPayload) }),

  obtenerEstadoFactura: (claveAcceso) =>
    request(`/invoices/${encodeURIComponent(claveAcceso)}/estado`),

  obtenerVentasPendientesFacturacion: () =>
    request('/invoices/pendientes'),

  reemitirFacturaVenta: (ventaId, payload = {}) =>
    request(`/invoices/reemitir/${encodeURIComponent(ventaId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Notas de Credito SRI (Devoluciones)
  emitirNotaCredito: (ncPayload) =>
    request('/credit-notes/emitir', {
      method: 'POST',
      body: JSON.stringify(ncPayload),
    }),

  descargarRide: async (claveAcceso) => {
    const baseUrl = getBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/invoices/${encodeURIComponent(claveAcceso)}/ride`, {
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError('Error al descargar RIDE PDF', res.status);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `RIDE_${claveAcceso}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  },

  descargarXml: async (claveAcceso) => {
    const baseUrl = getBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/invoices/${encodeURIComponent(claveAcceso)}/xml`, {
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError('Error al descargar XML firmado', res.status);
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${claveAcceso}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  },
};
