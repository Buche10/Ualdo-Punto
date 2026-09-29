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
    <div className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-white border-[var(--border)]'} shadow-sm`}>
      <div className="flex gap-2 relative">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Buscar producto por nombre o código para vender..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-4 py-2.5 text-xs rounded-full border focus:outline-none focus:ring-2 focus:ring-[var(--ualdo-aqua)] transition-all ${
              isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)] text-white' : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text)]'
            }`}
          />
          {filteredProducts.length > 0 && (
            <div className={`absolute top-full left-0 right-0 mt-1 z-30 rounded-2xl border shadow-xl overflow-hidden divide-y ${
              isDarkMode ? 'bg-[var(--surface)] border-[var(--border)] divide-[var(--border)] text-white' : 'bg-white border-[var(--border)] divide-[var(--border)] text-[var(--text)]'
            }`}>
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAddToCart(p)}
                  className="w-full text-left p-2.5 text-xs flex justify-between hover:bg-[var(--ualdo-aqua)]/15 transition-colors"
                >
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{p.category} • Stock: {p.theoreticalStock ?? 0}</p>
                  </div>
                  <span className="font-mono font-bold text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]">
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
          className="btn-pill-primary px-4 py-2 text-xs"
        >
          <Camera className="w-4 h-4" />
          <span className="hidden sm:inline">Escanear</span>
        </button>
      </div>
    </div>
  );
};
