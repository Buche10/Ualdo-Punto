import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/apiClient';

export function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await apiClient.login(email, password);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setErrorMessage('Credenciales invalidas. Verifique su correo y contrasena.');
      }
    } catch (err) {
      setErrorMessage(
        err.status === 429
          ? 'Demasiados intentos fallidos. Intente nuevamente en un minuto.'
          : 'Credenciales invalidas. Verifique su correo y contrasena.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[var(--ualdo-pizarra)] text-[var(--ualdo-blanco)] font-sans p-4 sm:p-8">
      {/* Header institucional */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-4">
        <div className="flex items-center space-x-3">
          <img
            src="/ualdo-logo-horizontal-fondo-oscuro.png"
            alt="Ualdo Negocios"
            className="h-10 w-auto object-contain"
            width="140"
            height="36"
          />
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-xs text-[var(--ualdo-aqua)] bg-[var(--ualdo-negro)]/40 px-3 py-1.5 rounded-full border border-[var(--ualdo-aqua)]/20">
          <ShieldCheck className="w-4 h-4 text-[var(--ualdo-aqua)]" />
          <span>Acceso Seguro Farmacia Valwis</span>
        </div>
      </header>

      {/* Contenedor central de Login */}
      <main className="w-full max-w-md mx-auto my-auto py-8">
        <div className="bg-[var(--ualdo-negro)]/80 backdrop-blur-md border border-[var(--ualdo-aqua)]/25 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6 text-left">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Iniciar <span className="text-[var(--ualdo-aqua)]">Sesion</span>
            </h1>
            <p className="text-sm text-gray-300">
              Sistema de Punto de Venta e Inventario para <strong className="text-[var(--ualdo-aqua)]">Farmacia Valwis</strong>.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-sm flex items-start space-x-2.5"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium uppercase tracking-wider text-gray-300 mb-1.5 text-left"
              >
                Correo Electronico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@farmaciavalwis.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--ualdo-pizarra)]/60 border border-[var(--ualdo-aqua)]/25 rounded-xl text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ualdo-aqua)] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium uppercase tracking-wider text-gray-300 mb-1.5 text-left"
              >
                Contrasena
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--ualdo-pizarra)]/60 border border-[var(--ualdo-aqua)]/25 rounded-xl text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ualdo-aqua)] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 flex items-center justify-center space-x-2 py-3 px-6 rounded-full bg-[var(--ualdo-petroleo)] hover:bg-[var(--ualdo-turquesa)] text-white font-medium text-sm transition-all duration-200 shadow-lg shadow-[var(--ualdo-petroleo)]/30 hover:shadow-[var(--ualdo-turquesa)]/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{isLoading ? 'Verificando credenciales...' : 'Ingresar al sistema'}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </main>

      {/* Footer institucional */}
      <footer className="w-full max-w-5xl mx-auto py-4 text-center text-xs text-gray-400">
        <p>&copy; 2026 Ualdo — Una marca de Santamaría Velasco & Asociados.</p>
      </footer>
    </div>
  );
}
