import { test, expect } from '@playwright/test';

test.describe('Autenticacion Ualdo Negocios — Flujo E2E Valwis (Login -> POS -> Logout)', () => {
  test('debe permitir iniciar sesion, acceder al POS y cerrar sesion', async ({ page }) => {
    let isAuthenticated = false;

    // Interceptar /api/auth/me
    await page.route('**/api/auth/me', async (route) => {
      if (!isAuthenticated) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Acceso no autorizado' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 'usr-valwis-1',
              email: 'admin@valwis.farmacia',
              nombre: 'Administrador Valwis',
              rol: 'admin',
              empresa: { id: 'emp-1', nombre: 'Valwis' },
            },
          }),
        });
      }
    });

    // Interceptar /api/auth/login
    await page.route('**/api/auth/login', async (route) => {
      const postData = route.request().postDataJSON();
      if (postData.email === 'admin@valwis.farmacia' && postData.password === 'ValwisPass2026') {
        isAuthenticated = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'set-cookie': 'ualdo_session=fake_e2e_jwt; HttpOnly; Secure; SameSite=Strict; Path=/',
          },
          body: JSON.stringify({
            success: true,
            user: {
              id: 'usr-valwis-1',
              email: 'admin@valwis.farmacia',
              nombre: 'Administrador Valwis',
              rol: 'admin',
              empresa: { id: 'emp-1', nombre: 'Valwis' },
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Credenciales invalidas' }),
        });
      }
    });

    // Interceptar /api/auth/logout
    await page.route('**/api/auth/logout', async (route) => {
      isAuthenticated = false;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Sesion cerrada exitosamente' }),
      });
    });

    // 1. Cargar aplicacion sin sesion activa
    await page.goto('/');

    // 2. Verificar que muestra la pantalla de login con marca Ualdo Negocios
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Iniciar');
    await expect(page.getByText('Farmacia Valwis').first()).toBeVisible();

    // 3. Probar intento fallido con credenciales erroneas
    await page.getByLabel('Correo Electronico').fill('admin@valwis.farmacia');
    await page.getByLabel('Contrasena').fill('ClaveErronea123');
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Credenciales invalidas');

    // 4. Iniciar sesion con credenciales correctas
    await page.getByLabel('Contrasena').fill('ValwisPass2026');
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click();

    // 5. Verificar acceso exitoso al POS
    await expect(page.getByText('Administrador Valwis')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar sesion' })).toBeVisible();

    // 6. Cerrar sesion
    await page.getByRole('button', { name: 'Cerrar sesion' }).click();

    // 7. Verificar que vuelve a la pantalla de login
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Iniciar');
    await expect(page.getByRole('button', { name: 'Ingresar al sistema' })).toBeVisible();
  });
});
