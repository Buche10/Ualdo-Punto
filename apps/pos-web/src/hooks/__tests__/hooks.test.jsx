import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useClientes } from '../useClientes';
import { useEmitirFactura } from '../useEmitirFactura';
import { useEstadoComprobante } from '../useEstadoComprobante';

const server = setupServer(
  http.get('*/clientes/buscar', ({ request }) => {
    const url = new URL(request.url);
    const identificacion = url.searchParams.get('identificacion');
    if (identificacion === '1710034065') {
      return HttpResponse.json({
        success: true,
        data: {
          id: 'cust-1',
          tipoIdentificacion: '05',
          identificacion: '1710034065',
          razonSocial: 'JUAN PEREZ',
        },
      });
    }
    return HttpResponse.json({ success: true, data: null });
  }),

  http.post('*/clientes', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: { id: 'cust-new', ...body },
    });
  }),

  http.post('*/invoices/emitir', async ({ request }) => {
    const body = await request.json();
    if (!body.comprador) {
      return new HttpResponse(JSON.stringify({ message: 'Cliente requerido' }), { status: 400 });
    }
    return HttpResponse.json({
      success: true,
      data: {
        id: 'comp-123',
        claveAcceso: '2209202601179001691900110010010000000011234567818',
        estado: 'FIRMADO',
      },
    });
  }),

  http.get('*/invoices/:clave/estado', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        id: 'comp-123',
        claveAcceso: params.clave,
        estado: 'AUTORIZADO',
        numAutorizacion: '2209202601179001691900110010010000000011234567818',
        fechaAutorizacion: '2026-09-22T15:00:00Z',
      },
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Hooks de Integración Frontend con MSW', () => {
  it('useClientes debe buscar cliente existente y manejar loading/success', async () => {
    const { result } = renderHook(() => useClientes());

    expect(result.current.loading).toBe(false);
    expect(result.current.cliente).toBeNull();

    let res;
    await act(async () => {
      res = await result.current.buscar('1710034065');
    });

    expect(res?.razonSocial).toBe('JUAN PEREZ');
    expect(result.current.cliente?.identificacion).toBe('1710034065');
    expect(result.current.loading).toBe(false);
  });

  it('useEmitirFactura debe emitir factura y retornar clave de acceso', async () => {
    const { result } = renderHook(() => useEmitirFactura());

    expect(result.current.loading).toBe(false);

    let invoiceRes;
    await act(async () => {
      invoiceRes = await result.current.emitir({
        comprador: { identificacion: '1710034065' },
        items: [],
      });
    });

    expect(invoiceRes?.claveAcceso).toBe('2209202601179001691900110010010000000011234567818');
    expect(result.current.factura?.estado).toBe('FIRMADO');
    expect(result.current.loading).toBe(false);
  });

  it('useEmitirFactura debe capturar error en caso de fallo 400', async () => {
    const { result } = renderHook(() => useEmitirFactura());

    await act(async () => {
      try {
        await result.current.emitir({});
      } catch {
        // Ignorar error esperado
      }
    });

    expect(result.current.error).toContain('Cliente requerido');
    expect(result.current.loading).toBe(false);
  });

  it('useEstadoComprobante debe realizar polling hasta estado AUTORIZADO', async () => {
    const { result } = renderHook(() =>
      useEstadoComprobante('2209202601179001691900110010010000000011234567818', {
        interval: 100,
      })
    );

    act(() => {
      result.current.startPolling('2209202601179001691900110010010000000011234567818');
    });

    await waitFor(() => {
      expect(result.current.estado).toBe('AUTORIZADO');
    });

    expect(result.current.data?.numAutorizacion).toBeDefined();
    expect(result.current.isPolling).toBe(false);
  });
});
