import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SalesScreen } from '../SalesScreen';
import { calculateInvoiceTotals } from '@pharmastock/shared';

const mockProducts = [
  {
    id: 'prod-1',
    barcode: '7791234567890',
    name: 'Ibuprofeno 600mg',
    category: 'Analgésico',
    unitPrice: 200, // $2.00
    tarifaIva: 0,
    theoreticalStock: 50,
  },
  {
    id: 'prod-2',
    barcode: '7798765432109',
    name: 'Alcohol antiséptico 500ml',
    category: 'Cuidado Personal',
    unitPrice: 300, // $3.00
    tarifaIva: 15,
    theoreticalStock: 25,
  },
];

describe('SalesScreen (Pantalla POS y Desglose Tributario Mixto SRI)', () => {
  it('debe calcular los totales de forma idéntica al motor compartido con tarifa mixta 0% y 15%', async () => {
    render(<SalesScreen products={mockProducts} isDarkMode={true} />);

    // Buscar y agregar producto 1 (Medicina 0%)
    const searchInput = screen.getByPlaceholderText(/Buscar producto por nombre o código/i);
    fireEvent.change(searchInput, { target: { value: 'Ibuprofeno' } });

    const btnProd1 = await screen.findByText('Ibuprofeno 600mg');
    fireEvent.click(btnProd1);

    // Buscar y agregar producto 2 (General 15%)
    fireEvent.change(searchInput, { target: { value: 'Alcohol' } });
    const btnProd2 = await screen.findByText('Alcohol antiséptico 500ml');
    fireEvent.click(btnProd2);

    // Esperado por el motor compartido:
    // Subtotal 0%: $2.00
    // Subtotal 15%: $3.00
    // IVA 15%: $0.45 (3.00 * 0.15)
    // Total: $5.45
    const expected = calculateInvoiceTotals([
      { id: '1', codigo: 'P1', descripcion: 'Ibuprofeno', cantidad: 1, precioUnitario: 2.00, descuento: 0, tarifaIva: 0, codigoPorcentajeIva: '0' },
      { id: '2', codigo: 'P2', descripcion: 'Alcohol', cantidad: 1, precioUnitario: 3.00, descuento: 0, tarifaIva: 15, codigoPorcentajeIva: '4' },
    ]);

    expect(screen.getAllByText(`$${expected.subtotal0.toFixed(2)}`).length).toBeGreaterThan(0);
    expect(screen.getAllByText(`$${expected.subtotal15.toFixed(2)}`).length).toBeGreaterThan(0);
    expect(screen.getByText(`$${expected.totalIva.toFixed(2)}`)).toBeDefined();
    expect(screen.getByText(`$${expected.importeTotal.toFixed(2)}`)).toBeDefined();
  });

  it('debe bloquear la emisión a Consumidor Final si supera los $50.00', async () => {
    const expensiveProduct = [
      {
        id: 'prod-expensive',
        barcode: '999111',
        name: 'Tratamiento Oncológico',
        category: 'Medicamento',
        unitPrice: 6000, // $60.00
        tarifaIva: 0,
        theoreticalStock: 10,
      },
    ];

    render(<SalesScreen products={expensiveProduct} isDarkMode={true} />);

    const searchInput = screen.getByPlaceholderText(/Buscar producto por nombre o código/i);
    fireEvent.change(searchInput, { target: { value: 'Tratamiento' } });

    const btnProd = await screen.findByText('Tratamiento Oncológico');
    fireEvent.click(btnProd);

    // La advertencia debe estar en el DOM
    expect(screen.getByText(/Ventas a Consumidor Final > \$50\.00 requieren identificar al comprador/i)).toBeDefined();

    // El botón de emitir factura debe estar deshabilitado
    const emitirBtn = screen.getByRole('button', { name: /Emitir Factura/i });
    expect(emitirBtn).toHaveProperty('disabled', true);
  });
});
