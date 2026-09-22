import React, { useState, useEffect } from 'react';
import { User, Search, CheckCircle, PlusCircle } from 'lucide-react';
import { useClientes } from '../../hooks/useClientes';
import { useDebounce } from '../../hooks/useDebounce';

const CONSUMIDOR_FINAL = {
  tipoIdentificacion: '07',
  identificacion: '9999999999999',
  razonSocial: 'CONSUMIDOR FINAL',
  direccion: 'N/A',
  email: 'consumidorfinal@pharmastock.ec',
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
    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'} shadow-sm space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-500" />
          <h3 className="font-bold text-sm">Datos del Cliente</h3>
        </div>
        <button
          type="button"
          onClick={handleSelectConsumidorFinal}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
            isCF
              ? 'bg-emerald-500 text-white shadow'
              : isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Consumidor Final
        </button>
      </div>

      {!isCreating ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Cédula o RUC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-24 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
            <button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setFormData((prev) => ({ ...prev, identificacion: searchTerm }));
              }}
              className="absolute right-2 top-1.5 px-2 py-1 text-[11px] font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Nuevo
            </button>
          </div>

          {loading && <p className="text-[11px] text-slate-400 animate-pulse">Buscando cliente...</p>}
          {error && <p className="text-[11px] text-rose-400">{error}</p>}

          {cliente && (
            <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
              isDarkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-emerald-50/50 border-emerald-200'
            }`}>
              <div>
                <p className="font-bold flex items-center gap-1.5 text-emerald-500">
                  <CheckCircle className="w-3.5 h-3.5" /> {cliente.razonSocial}
                </p>
                <p className="text-[11px] text-slate-400">
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
              <label className="text-[10px] font-bold text-slate-400">Tipo ID</label>
              <select
                value={formData.tipoIdentificacion}
                onChange={(e) => setFormData({ ...formData, tipoIdentificacion: e.target.value })}
                className={`w-full p-1.5 rounded-lg border text-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              >
                <option value="05">Cédula</option>
                <option value="04">RUC</option>
                <option value="06">Pasaporte</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400">Identificación</label>
              <input
                type="text"
                required
                value={formData.identificacion}
                onChange={(e) => setFormData({ ...formData, identificacion: e.target.value })}
                className={`w-full p-1.5 rounded-lg border text-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400">Razón Social / Nombre</label>
            <input
              type="text"
              required
              value={formData.razonSocial}
              onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
              className={`w-full p-1.5 rounded-lg border text-xs ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
              }`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full p-1.5 rounded-lg border text-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400">Dirección</label>
              <input
                type="text"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                className={`w-full p-1.5 rounded-lg border text-xs ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'
                }`}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1 text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 shadow"
            >
              {loading ? 'Guardando...' : 'Guardar y Usar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
