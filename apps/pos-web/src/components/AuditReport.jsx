import React, { useState } from 'react';
import { FileSpreadsheet, Printer, CheckCircle, AlertCircle, TrendingDown, TrendingUp, RefreshCw, ShieldCheck, Download } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSuccessChime } from '../utils/audio';
import { formatStockText } from '../data/mockPharmacyCatalog';

export const AuditReport = ({ products, onApplyAuditAdjustment, isDarkMode }) => {
  const [filterDiscrepancy, setFilterDiscrepancy] = useState('ALL');
  const [isSyncing, setIsSyncing] = useState(false);

  // Considerar únicamente como auditados aquellos con `isAudited === true` o `countedStock > 0`
  const auditData = products.map(prod => {
    const isAudited = prod.isAudited || prod.countedStock > 0;
    const countedUnits = isAudited ? prod.countedStock : prod.theoreticalStock;
    const diff = countedUnits - prod.theoreticalStock;
    const unitCost = prod.unitCost || (prod.boxCost / (prod.unitsPerBox || 1)) || 0;
    const diffCost = diff * unitCost;

    let status = 'MATCH';
    if (diff > 0) status = 'SURPLUS';
    if (diff < 0) status = 'DEFICIT';

    return {
      ...prod,
      isAudited,
      countedUnits,
      diff,
      unitCost,
      diffCost,
      status
    };
  });

  const totalItems = auditData.length;
  const itemsAuditedCount = auditData.filter(d => d.isAudited).length;
  const itemsWithDiscrepancy = auditData.filter(d => d.diff !== 0);
  const itemsFaltantes = auditData.filter(d => d.diff < 0);
  const itemsSobrantas = auditData.filter(d => d.diff > 0);

  const totalDeficitCost = itemsFaltantes.reduce((acc, d) => acc + Math.abs(d.diffCost), 0);
  const totalSurplusCost = itemsSobrantas.reduce((acc, d) => acc + d.diffCost, 0);
  const netFinancialImpact = totalSurplusCost - totalDeficitCost;

  const filteredAuditData = auditData.filter(item => {
    if (filterDiscrepancy === 'DIFFERENCE_ONLY') return item.diff !== 0;
    if (filterDiscrepancy === 'MATCH_ONLY') return item.diff === 0;
    if (filterDiscrepancy === 'AUDITED_ONLY') return item.isAudited;
    return true;
  });

  const handleConfirmAdjustment = () => {
    if (window.confirm(`¿Deseas aplicar el Ajuste de Inventario? Se actualizará el stock teórico oficial de los ${itemsAuditedCount} productos auditados (incluyendo mermas/faltantes a 0).`)) {
      setIsSyncing(true);
      onApplyAuditAdjustment();
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      playSuccessChime();

      setTimeout(() => {
        setIsSyncing(false);
      }, 800);
    }
  };

  const exportToCSV = () => {
    const headers = ["Codigo_EAN", "Medicamento", "Unidades_Por_Caja", "Stock_Teorico_Texto", "Stock_Contado_Texto", "Diferencia_Unidades", "Costo_Unitario", "Impacto_Financiero_Costo"];
    const rows = auditData.map(item => [
      item.barcode,
      `"${item.name.replace(/"/g, '""')}"`,
      item.unitsPerBox || 1,
      `"${formatStockText(item.theoreticalStock, item.unitsPerBox)}"`,
      `"${formatStockText(item.countedStock, item.unitsPerBox)}"`,
      item.diff,
      item.unitCost,
      item.diffCost
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Auditoria_Farmacia_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const cardBg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-md';
  const innerBg = isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-300';
  const textTitle = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="space-y-6 pb-12 animate-fade-in print:p-0 print:bg-white print:text-black">
      
      <div className={`${cardBg} border rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 print:hidden`}>
        <div>
          <h2 className={`text-xl font-bold ${textTitle} flex items-center gap-2`}>
            <FileSpreadsheet className="w-6 h-6 text-emerald-500" /> Reporte de Auditoría y Faltantes
          </h2>
          <p className={`${textSub} text-xs mt-1`}>Detecta mermas, robos o faltantes a 0 y aplica ajustes de stock en 1 clic</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={exportToCSV}
            className={`px-4 py-2.5 ${innerBg} ${textSub} hover:${textTitle} text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors`}
          >
            <Download className="w-4 h-4 text-emerald-500" /> Exportar CSV
          </button>
          
          <button
            onClick={handlePrint}
            className={`px-4 py-2.5 ${innerBg} ${textSub} hover:${textTitle} text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors`}
          >
            <Printer className="w-4 h-4 text-emerald-500" /> Imprimir
          </button>

          <button
            onClick={handleConfirmAdjustment}
            disabled={isSyncing || itemsAuditedCount === 0}
            className={`px-5 py-2.5 ${
              itemsAuditedCount > 0 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            } font-bold text-xs rounded-xl flex items-center gap-2 transition-all`}
          >
            <ShieldCheck className="w-4 h-4" /> APLICAR AJUSTE ({itemsAuditedCount} AUDITADOS)
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className={`${cardBg} border rounded-2xl p-5 shadow-xl print:border-black print:bg-white`}>
          <div className={`text-xs font-bold ${textSub} uppercase tracking-wider print:text-black`}>Diferencias de Auditoría</div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-black text-amber-500 print:text-black">{itemsWithDiscrepancy.length}</div>
            <div className={`text-xs ${textSub} print:text-black font-medium`}>{itemsAuditedCount} auditados</div>
          </div>
        </div>

        <div className={`${cardBg} border rounded-2xl p-5 shadow-xl print:border-black print:bg-white`}>
          <div className={`text-xs font-bold ${textSub} uppercase tracking-wider print:text-black`}>Pérdida por Faltante (Costo)</div>
          <div className="mt-2 text-2xl font-black text-rose-500 print:text-black">
            -${totalDeficitCost.toLocaleString()}
          </div>
        </div>

        <div className={`${cardBg} border rounded-2xl p-5 shadow-xl print:border-black print:bg-white`}>
          <div className={`text-xs font-bold ${textSub} uppercase tracking-wider print:text-black`}>Impacto Financiero Neto</div>
          <div className={`mt-2 text-2xl font-black ${
            netFinancialImpact < 0 ? 'text-rose-500' : netFinancialImpact > 0 ? 'text-emerald-500' : textTitle
          } print:text-black`}>
            {netFinancialImpact >= 0 ? `+$${netFinancialImpact.toLocaleString()}` : `-$${Math.abs(netFinancialImpact).toLocaleString()}`}
          </div>
        </div>

      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 print:hidden">
        <span className={`text-xs ${textSub} font-semibold`}>Mostrar:</span>
        <button
          onClick={() => setFilterDiscrepancy('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            filterDiscrepancy === 'ALL' ? 'bg-emerald-600 text-white' : `${innerBg} ${textSub}`
          }`}
        >
          Todos ({auditData.length})
        </button>
        <button
          onClick={() => setFilterDiscrepancy('AUDITED_ONLY')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            filterDiscrepancy === 'AUDITED_ONLY' ? 'bg-indigo-600 text-white' : `${innerBg} ${textSub}`
          }`}
        >
          Solo Auditados en Sesión ({itemsAuditedCount})
        </button>
        <button
          onClick={() => setFilterDiscrepancy('DIFFERENCE_ONLY')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
            filterDiscrepancy === 'DIFFERENCE_ONLY' ? 'bg-amber-600 text-white' : `${innerBg} ${textSub}`
          }`}
        >
          Solo Con Descuadre ({itemsWithDiscrepancy.length})
        </button>
      </div>

      {/* Tabla Auditada */}
      <div className={`${cardBg} border rounded-2xl shadow-xl overflow-hidden print:border-black print:bg-white`}>
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-sm ${textSub} print:text-black`}>
            <thead className={`${innerBg} border-b text-slate-400 uppercase text-[11px] font-bold print:bg-gray-100 print:text-black`}>
              <tr>
                <th className="px-5 py-3.5">Medicamento</th>
                <th className="px-4 py-3.5 text-center">Unid/Caja</th>
                <th className="px-4 py-3.5 text-center">Stock Sistema</th>
                <th className="px-4 py-3.5 text-center">Stock Contado</th>
                <th className="px-4 py-3.5 text-center">Diferencia</th>
                <th className="px-4 py-3.5 text-right">Impacto Financiero</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40 print:divide-gray-300">
              {filteredAuditData.length > 0 ? (
                filteredAuditData.map(item => (
                  <tr key={item.id} className="hover:bg-emerald-500/5 transition-colors">
                    
                    <td className="px-5 py-4">
                      <div className={`font-bold ${textTitle} print:text-black`}>{item.name}</div>
                      <div className={`text-xs ${textSub} font-mono print:text-gray-600`}>{item.barcode}</div>
                    </td>

                    <td className="px-4 py-4 text-center text-xs font-bold">
                      {item.unitsPerBox || 1} un.
                    </td>

                    <td className={`px-4 py-4 text-center text-xs ${textSub}`}>
                      {formatStockText(item.theoreticalStock, item.unitsPerBox)}
                    </td>

                    <td className="px-4 py-4 text-center font-bold text-emerald-500 text-xs">
                      {item.isAudited ? formatStockText(item.countedStock, item.unitsPerBox) : 'Pendiente'}
                    </td>

                    <td className="px-4 py-4 text-center">
                      {item.isAudited ? (
                        <span className={`font-black text-xs px-2.5 py-1 rounded-lg ${
                          item.diff < 0 
                            ? 'text-rose-500 bg-rose-500/10 border border-rose-500/30'
                            : item.diff > 0
                            ? 'text-amber-500 bg-amber-500/10 border border-amber-500/30'
                            : 'text-emerald-500 bg-emerald-500/10'
                        }`}>
                          {formatStockText(item.diff, item.unitsPerBox)}
                        </span>
                      ) : (
                        <span className={`text-xs ${textSub}`}>-</span>
                      )}
                    </td>

                    <td className={`px-4 py-4 text-right font-bold ${textTitle} print:text-black`}>
                      {item.isAudited ? (
                        <span className={item.diffCost < 0 ? 'text-rose-500' : item.diffCost > 0 ? 'text-amber-500' : textSub}>
                          {item.diffCost > 0 ? `+$${item.diffCost.toLocaleString()}` : item.diffCost < 0 ? `-$${Math.abs(item.diffCost).toLocaleString()}` : '$0'}
                        </span>
                      ) : '$0'}
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400 text-sm">
                    No se encontraron registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
