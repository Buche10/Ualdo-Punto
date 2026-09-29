import React, { useState, useMemo } from 'react';
import { calculateInvoiceTotals } from '@pharmastock/shared';
import { CustomerSelector } from './CustomerSelector';
import { CartTable } from './CartTable';
import { InvoiceStatusModal } from './InvoiceStatusModal';
import { ScannerModal } from '../ScannerModal';
import { ProductSearchBar } from './ProductSearchBar';
import { SalesSummaryPanel } from './SalesSummaryPanel';
import { DevolucionModal } from './DevolucionModal';
import { ReconciliacionModal } from './ReconciliacionModal';
import { apiClient } from '../../api/apiClient';
import { ArrowLeftRight, ShieldAlert } from 'lucide-react';

export const SalesScreen = ({ products = [], onSaleCompleted, isDarkMode }) => {
  const [cart, setCart] = useState([]);
  const [cliente, setCliente] = useState({
    tipoIdentificacion: '07',
    identificacion: '9999999999999',
    razonSocial: 'CONSUMIDOR FINAL',
  });
  const [formaPago, setFormaPago] = useState('01');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [devolucionModalOpen, setDevolucionModalOpen] = useState(false);
  const [reconciliacionModalOpen, setReconciliacionModalOpen] = useState(false);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products
      .filter((p) => p.name?.toLowerCase().includes(q) || p.barcode?.includes(q) || p.id?.includes(q))
      .slice(0, 6);
  }, [products, searchQuery]);

  const totals = useMemo(() => {
    const cartItems = cart.map((it) => ({
      id: it.productoId,
      codigo: it.codigo,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      descuento: it.descuento || 0,
      tarifaIva: it.tarifaIva,
      codigoPorcentajeIva: it.codigoPorcentajeIva,
    }));
    return calculateInvoiceTotals(cartItems);
  }, [cart]);

  const esCF = cliente?.identificacion === '9999999999999' || cliente?.tipoIdentificacion === '07';
  const excedeConsumidorFinal = esCF && totals.excedeLimiteConsumidorFinal;

  const handleAddToCart = (product) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productoId === product.id);
      const isMedicine = /analg|antib|antiinf|antipir|medicamento/i.test(product.category || '');
      const tarifa = product.tarifaIva !== undefined ? product.tarifaIva : isMedicine ? 0 : 15;
      const unitPrice = (product.unitPrice || 100) / 100;

      if (idx >= 0) {
        const next = [...prev];
        next[idx].cantidad += 1;
        return next;
      }
      return [
        ...prev,
        {
          productoId: product.id,
          codigo: product.barcode || product.id,
          descripcion: product.name,
          cantidad: 1,
          precioUnitario: unitPrice,
          descuento: 0,
          tarifaIva: tarifa,
          codigoPorcentajeIva: tarifa === 0 ? '0' : '4',
        },
      ];
    });
    setSearchQuery('');
  };

  const handleScanSuccess = (barcode) => {
    const found = products.find((p) => p.barcode === barcode);
    if (found) {
      handleAddToCart(found);
      setIsScannerOpen(false);
    } else {
      setErrorMessage(`Producto con código ${barcode} no encontrado en catálogo`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleEmitir = async () => {
    if (cart.length === 0 || excedeConsumidorFinal || isProcessing) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const ventaRes = await apiClient.registrarVenta({
        cliente,
        items: cart,
        formaPagoCodigo: formaPago,
      });

      const ventaId = ventaRes?.data?.ventaId || ventaRes?.ventaId;

      const invoicePayload = {
        emisor: {
          ruc: '1790016919001',
          razonSocial: 'FARMACIA PHARMASTOCK EXPRESS CIA. LTDA.',
          dirMatriz: 'Av. Amazonas N24-15 y Colón, Quito',
          dirEstablecimiento: 'Av. Amazonas N24-15 y Colón, Quito',
          obligadoContabilidad: 'SI',
          regimenRimpe: 'CONTRIBUYENTE RÉGIMEN RIMPE',
        },
        establecimiento: '001',
        puntoEmision: '001',
        comprador: cliente,
        items: cart,
        formaPagoCodigo: formaPago,
        ventaId,
      };

      const invoiceRes = await apiClient.emitirFactura(invoicePayload);
      const invoiceData = invoiceRes?.data || invoiceRes;

      setInvoiceData(invoiceData);
      setInvoiceModalOpen(true);

      if (onSaleCompleted) {
        onSaleCompleted(cart);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error al procesar la venta y factura');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <ProductSearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredProducts={filteredProducts}
            onAddToCart={handleAddToCart}
            onOpenScanner={() => setIsScannerOpen(true)}
            isDarkMode={isDarkMode}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReconciliacionModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition border shadow-sm ${
              isDarkMode
                ? 'bg-slate-900 border-slate-700/80 text-amber-400 hover:bg-slate-800 hover:text-amber-300'
                : 'bg-white border-slate-200 text-amber-600 hover:bg-amber-50'
            }`}
            title="Reconciliar comprobantes en contingencia SRI"
          >
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Reconciliar</span>
          </button>
          <button
            type="button"
            onClick={() => setDevolucionModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold transition border shadow-sm ${
              isDarkMode
                ? 'bg-slate-900 border-slate-700/80 text-rose-400 hover:bg-slate-800 hover:text-rose-300'
                : 'bg-white border-slate-200 text-rose-600 hover:bg-rose-50'
            }`}
            title="Emitir Nota de Crédito (Devolución)"
          >
            <ArrowLeftRight className="w-4 h-4 text-rose-500" />
            <span className="hidden sm:inline">Devolución / NC</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 space-y-4">
          <CartTable
            items={cart}
            isDarkMode={isDarkMode}
            onUpdateQuantity={(id, q) => setCart((prev) => prev.map((i) => i.productoId === id ? { ...i, cantidad: Math.max(1, q) } : i))}
            onUpdateDiscount={(id, d) => setCart((prev) => prev.map((i) => i.productoId === id ? { ...i, descuento: Math.max(0, d) } : i))}
            onRemoveItem={(id) => setCart((prev) => prev.filter((i) => i.productoId !== id))}
            onToggleIva={(id) => setCart((prev) => prev.map((i) => i.productoId === id ? { ...i, tarifaIva: i.tarifaIva === 0 ? 15 : 0, codigoPorcentajeIva: i.tarifaIva === 0 ? '4' : '0' } : i))}
          />
        </div>

        <div className="lg:col-span-4 space-y-4">
          <CustomerSelector cliente={cliente} onSelectCliente={setCliente} isDarkMode={isDarkMode} />
          <SalesSummaryPanel
            formaPago={formaPago}
            setFormaPago={setFormaPago}
            totals={totals}
            excedeConsumidorFinal={excedeConsumidorFinal}
            cartEmpty={cart.length === 0}
            isProcessing={isProcessing}
            onEmitir={handleEmitir}
            isDarkMode={isDarkMode}
          />
        </div>
      </div>

      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      <InvoiceStatusModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        claveAcceso={invoiceData?.claveAcceso}
        initialData={invoiceData}
        onNewSale={() => {
          setCart([]);
          setInvoiceModalOpen(false);
          setInvoiceData(null);
        }}
        clientEmail={cliente?.email}
        isDarkMode={isDarkMode}
      />

      <DevolucionModal
        isOpen={devolucionModalOpen}
        onClose={() => setDevolucionModalOpen(false)}
        isDarkMode={isDarkMode}
      />

      <ReconciliacionModal
        isOpen={reconciliacionModalOpen}
        onClose={() => setReconciliacionModalOpen(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
