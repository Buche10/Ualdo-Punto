import React, { useState, useEffect } from 'react';
import { User, Search, CheckCircle, PlusCircle } from 'lucide-react';
import { useClientes } from '../../hooks/useClientes';
import { useDebounce } from '../../hooks/useDebounce';

const CONSUMIDOR_FINAL = {
  tipoIdentificacion: '07',
  identificacion: '9999999999999',
  razonSocial: 'CONSUMIDOR FINAL',
  direccion: 'N/A',
  email: 'consumidorfinal@ualdocorp.com',
};

export const CustomerSelector = ({ cliente, onSelectCliente, isDarkMode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    tipoIdentificacion: '05',
    identificacion: '',
    razonSocial: '',
    direccion: '',
    telefono: '',
    email: '',
  });

  const debouncedSearch = useDebounce(searchTerm, 400);
  const { buscar, crear, loading, error } = useClientes();

  useEffect(() => {
    if (debouncedSearch && debouncedSearch.length >= 3 && !isCreating) {
      buscar(debouncedSearch).then((found) => {
        if (found) {
          onSelectCliente(found);
        }
      });
    }
  }, [debouncedSearch, buscar, onSelectCliente, isCreating]);

  const handleSelectConsumidorFinal = () => {
    setIsCreating(false);
    setSearchTerm('');
    onSelectCliente(CONSUMIDOR_FINAL);
  };

  const handleSaveNewClient = async (e) => {
    e.preventDefault();
    try {
      const saved = await crear(formData);
      onSelectCliente(saved);
      setIsCreating(false);
      setSearchTerm('');
    } catch {
      // Error handled by hook
    }
  };

  const isCF = cliente?.identificacion === '9999999999999';

  return (
    <div className={`p-4 rounded-3xl border ${isDarkMode ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-white border-[var(--border)]'} shadow-sm space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]" />
          <h3 className="font-bold text-sm text-[var(--text)]">Datos del Cliente</h3>
        </div>
        <button
          type="button"
          onClick={handleSelectConsumidorFinal}
          className={`btn-pill-secondary px-3 py-1 text-xs ${
            isCF
              ? 'bg-[var(--ualdo-petroleo)] text-white dark:bg-[var(--ualdo-aqua)] dark:text-[var(--ualdo-negro)]'
              : ''
          }`}
        >
          Consumidor Final
        </button>
      </div>

      {!isCreating ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por Cédula o RUC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-24 py-2 text-xs rounded-full border focus:outline-none focus:ring-2 focus:ring-[var(--ualdo-aqua)] transition-all ${
                isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)] text-white' : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text)]'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setFormData((prev) => ({ ...prev, identificacion: searchTerm }));
              }}
              className="absolute right-2 top-1.5 px-2 py-1 text-[11px] font-bold text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)] hover:underline flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Nuevo
            </button>
          </div>

          {loading && <p className="text-[11px] text-[var(--text-muted)] animate-pulse">Buscando cliente...</p>}
          {error && <p className="text-[11px] text-rose-400">{error}</p>}

          {cliente && (
            <div className={`p-2.5 rounded-2xl border flex items-center justify-between text-xs ${
              isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)]' : 'bg-[var(--surface-muted)] border-[var(--border)]'
            }`}>
              <div>
                <p className="font-bold flex items-center gap-1.5 text-[var(--ualdo-petroleo)] dark:text-[var(--ualdo-aqua)]">
                  <CheckCircle className="w-3.5 h-3.5" /> {cliente.razonSocial}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {cliente.tipoIdentificacion === '04' ? 'RUC' : cliente.tipoIdentificacion === '05' ? 'Cédula' : 'ID'}: {cliente.identificacion}
                  {cliente.email ? ` • ${cliente.email}` : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSaveNewClient} className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-[var(--text-muted)]">Tipo ID</label>
              <select
                value={formData.tipoIdentificacion}
                onChange={(e) => setFormData({ ...formData, tipoIdentificacion: e.target.value })}
                className={`w-full p-1.5 rounded-xl border text-xs ${
                  isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)] text-white' : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text)]'
                }`}
              >
                <option value="05">Cédula</option>
                <option value="04">RUC</option>
                <option value="06">Pasaporte</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-muted)]">Identificación</label>
              <input
                type="text"
                required
                value={formData.identificacion}
                onChange={(e) => setFormData({ ...formData, identificacion: e.target.value })}
                className={`w-full p-1.5 rounded-xl border text-xs ${
                  isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)] text-white' : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text)]'
                }`}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)]">Razón Social / Nombre</label>
            <input
              type="text"
              required
              value={formData.razonSocial}
              onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
              className={`w-full p-1.5 rounded-xl border text-xs ${
                isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)] text-white' : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text)]'
              }`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-[var(--text-muted)]">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full p-1.5 rounded-xl border text-xs ${
                  isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)] text-white' : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text)]'
                }`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-muted)]">Dirección</label>
              <input
                type="text"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                className={`w-full p-1.5 rounded-xl border text-xs ${
                  isDarkMode ? 'bg-[var(--surface-muted)] border-[var(--border)] text-white' : 'bg-[var(--surface-muted)] border-[var(--border)] text-[var(--text)]'
                }`}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1 text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-pill-primary px-4 py-1.5 text-xs"
            >
              {loading ? 'Guardando...' : 'Guardar y Usar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
