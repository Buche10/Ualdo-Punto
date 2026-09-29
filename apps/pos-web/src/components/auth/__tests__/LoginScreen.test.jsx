import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LoginScreen } from '../LoginScreen';
import { apiClient } from '../../../api/apiClient';

vi.mock('../../../api/apiClient', () => ({
  apiClient: {
    login: vi.fn(),
  },
}));

describe('LoginScreen Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la interfaz de login con la marca Ualdo y Farmacia Valwis', () => {
    render(<LoginScreen onLoginSuccess={vi.fn()} />);

    const logo = screen.getByAltText('Ualdo Negocios');
    expect(logo).toBeInTheDocument();

    const valwisMentions = screen.getAllByText(/Farmacia Valwis/i);
    expect(valwisMentions.length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Correo Electronico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contrasena/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ingresar al sistema/i })).toBeInTheDocument();
  });

  it('ejecuta login exitoso y notifica al componente padre', async () => {
    const onLoginSuccess = vi.fn();
    const mockUser = { id: 'usr-1', email: 'admin@valwis.farmacia', rol: 'admin' };
    vi.mocked(apiClient.login).mockResolvedValueOnce({
      success: true,
      user: mockUser,
    });

    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);

    fireEvent.change(screen.getByLabelText(/Correo Electronico/i), {
      target: { value: 'admin@valwis.farmacia' },
    });
    fireEvent.change(screen.getByLabelText(/Contrasena/i), {
      target: { value: 'PasswordValwis2026' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Ingresar al sistema/i }));

    await waitFor(() => {
      expect(apiClient.login).toHaveBeenCalledWith('admin@valwis.farmacia', 'PasswordValwis2026');
      expect(onLoginSuccess).toHaveBeenCalledWith(mockUser);
    });
  });

  it('muestra mensaje de error generico ante credenciales invalidas', async () => {
    vi.mocked(apiClient.login).mockRejectedValueOnce({
      status: 401,
      message: 'Credenciales invalidas',
    });

    render(<LoginScreen onLoginSuccess={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Correo Electronico/i), {
      target: { value: 'admin@valwis.farmacia' },
    });
    fireEvent.change(screen.getByLabelText(/Contrasena/i), {
      target: { value: 'ClaveErronea' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Ingresar al sistema/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/Credenciales invalidas/i);
    });
  });
});
