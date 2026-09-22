import React from 'react';
import { Search, Camera } from 'lucide-react';

export const ProductSearchBar = ({
  searchQuery,
  setSearchQuery,
  filteredProducts,
  onAddToCart,
  onOpenScanner,
  isDarkMode,
}) => {
  return (
    <div className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
      <div className="flex gap-2 relative">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar producto por nombre o código para vender..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
              isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
            }`}
          />
          {filteredProducts.length > 0 && (
            <div className={`absolute top-full left-0 right-0 mt-1 z-30 rounded-xl border shadow-xl overflow-hidden divide-y ${
              isDarkMode ? 'bg-slate-800 border-slate-700 divide-slate-700 text-slate-100' : 'bg-white border-slate-200 divide-slate-100 text-slate-900'
            }`}>
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAddToCart(p)}
                  className="w-full text-left p-2.5 text-xs flex justify-between hover:bg-emerald-500/20 transition-colors"
                >
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.category} • Stock: {p.theoreticalStock ?? 0}</p>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">
                    ${((p.unitPrice || 100) / 100).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenScanner}
          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-all text-xs"
        >
          <Camera className="w-4 h-4" />
          <span className="hidden sm:inline">Escanear</span>
        </button>
      </div>
    </div>
  );
};
