import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReconciliacionModal } from '../ReconciliacionModal';
import { apiClient } from '../../../api/apiClient';

vi.mock('../../../api/apiClient', () => ({
  apiClient: {
    obtenerVentasPendientesFacturacion: vi.fn(),
    reemitirFacturaVenta: vi.fn(),
  },
}));

describe('ReconciliacionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no debe renderizar nada si isOpen es false', () => {
    const { container } = render(
      <ReconciliacionModal isOpen={false} onClose={vi.fn()} isDarkMode={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('debe cargar y mostrar la lista de ventas pendientes y en contingencia al abrir', async () => {
    apiClient.obtenerVentasPendientesFacturacion.mockResolvedValueOnce([
      {
        ventaId: 'v-cont-1',
        fecha: '2026-09-28T10:00:00Z',
        importeTotal: 15.5,
        formaPagoCodigo: '01',
        estadoVenta: 'COMPLETADA',
        motivo: 'EN_CONTINGENCIA',
        cliente: { razon_social: 'JUAN PEREZ', identificacion: '1710034065' },
        comprobante: { secuencial: '001-001-000000042', estado: 'EN_CONTINGENCIA' },
      },
    ]);

    render(<ReconciliacionModal isOpen={true} onClose={vi.fn()} isDarkMode={false} />);

    expect(screen.getByText('Reconciliación de Comprobantes SRI')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('JUAN PEREZ')).toBeInTheDocument();
      expect(screen.getByText('EN_CONTINGENCIA')).toBeInTheDocument();
      expect(screen.getByText('$15.50')).toBeInTheDocument();
    });
  });

  it('debe llamar a reemitirFacturaVenta al hacer clic en Re-emitir Factura', async () => {
    apiClient.obtenerVentasPendientesFacturacion
      .mockResolvedValueOnce([
        {
          ventaId: 'v-cont-2',
          fecha: '2026-09-28T11:00:00Z',
          importeTotal: 20.0,
          motivo: 'SIN_COMPROBANTE',
          cliente: { razon_social: 'FARMACIA CLIENTE' },
        },
      ])
      .mockResolvedValueOnce([]); // Segunda llamada tras éxito

    apiClient.reemitirFacturaVenta.mockResolvedValueOnce({
      claveAcceso: '2909202601179001691900110010010000000011234567818',
      mensaje: 'Re-emisión exitosa',
    });

    render(<ReconciliacionModal isOpen={true} onClose={vi.fn()} isDarkMode={false} />);

    await waitFor(() => {
      expect(screen.getByText('Re-emitir Factura')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Re-emitir Factura'));

    await waitFor(() => {
      expect(apiClient.reemitirFacturaVenta).toHaveBeenCalledWith('v-cont-2');
      expect(screen.getByText(/Re-emisión exitosa/i)).toBeInTheDocument();
    });
  });
});
