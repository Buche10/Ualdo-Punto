import { test, expect } from '@playwright/test';

test.describe('POS Farmacia — Flujo End-to-End SRI (Venta, RIDE, Devolución y Reconciliación)', () => {
  const FAKE_CLAVE_ACCESO = '2909202601179001691900110010010000000011234567818';
  const FAKE_NC_CLAVE_ACCESO = '2909202604179001691900110010010000000011234567812';

  test.beforeEach(async ({ page }) => {
    // Interceptar sesion autenticada
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: {
            id: 'usr-valwis-e2e',
            email: 'admin@valwis.farmacia',
            nombre: 'Admin Valwis',
            rol: 'admin',
            empresa: { id: 'emp-valwis', nombre: 'Valwis' },
          },
        }),
      });
    });

    // Interceptar llamadas API hacia el backend para pruebas E2E deterministas
    await page.route('**/api/ventas', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exito: true,
          data: { ventaId: 'venta-e2e-uuid-1', importeTotal: 2.5 },
        }),
      });
    });

    await page.route('**/api/invoices/emitir', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          claveAcceso: FAKE_CLAVE_ACCESO,
          secuencial: '001-001-000000001',
          estado: 'AUTORIZADO',
          numAutorizacion: FAKE_CLAVE_ACCESO,
          fechaAutorizacion: new Date().toISOString(),
          ambiente: 'PRUEBAS',
          totales: { totalSinImpuestos: 2.5, totalIva: 0, importeTotal: 2.5 },
          mensaje: 'Factura autorizada exitosamente por el SRI',
        }),
      });
    });

    await page.route(`**/api/invoices/${FAKE_CLAVE_ACCESO}/estado`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          claveAcceso: FAKE_CLAVE_ACCESO,
          estado: 'AUTORIZADO',
          numAutorizacion: FAKE_CLAVE_ACCESO,
          mensajes: [],
        }),
      });
    });

    await page.route(`**/api/invoices/${FAKE_CLAVE_ACCESO}/ride`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 Fake RIDE content for testing'),
      });
    });

    await page.route('**/api/credit-notes/emitir', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'nc-uuid-e2e',
          claveAcceso: FAKE_NC_CLAVE_ACCESO,
          secuencial: '001-001-000000001',
          documentoModificado: {
            tipo: '01',
            numDoc: '001-001-000000001',
            claveAcceso: FAKE_CLAVE_ACCESO,
          },
          totales: { totalSinImpuestos: 2.5, importeTotal: 2.5 },
          estado: 'AUTORIZADO',
          mensaje: 'Nota de Crédito emitida y autorizada ante el SRI.',
        }),
      });
    });

    await page.route('**/api/invoices/pendientes', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            ventaId: 'venta-contingencia-1',
            fecha: new Date().toISOString(),
            importeTotal: 15.0,
            motivo: 'EN_CONTINGENCIA',
            cliente: { razon_social: 'CONSUMIDOR FINAL', identificacion: '9999999999999' },
            comprobante: { secuencial: '001-001-000000005', estado: 'EN_CONTINGENCIA' },
          },
        ]),
      });
    });

    await page.route('**/api/invoices/reemitir/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exito: true,
          claveAcceso: '2909202601179001691900110010010000000055555555518',
          mensaje: 'Factura re-emitida y encolada para autorización',
        }),
      });
    });

    // Navegar a la app e ingresar a la pestaña del POS Facturación SRI
    await page.goto('/');
    const posTabBtn = page.getByRole('button', { name: /Facturar \(POS SRI\)/i });
    await expect(posTabBtn).toBeVisible({ timeout: 10000 });
    await posTabBtn.click();
  });

  test('E2E: Venta POS genera Factura AUTORIZADA y permite descargar RIDE PDF', async ({ page }) => {
    // 1. Buscar y agregar producto al carrito
    const searchInput = page.getByPlaceholder(/Buscar producto/i);
    await searchInput.fill('Paracetamol');

    // Clic en el producto sugerido
    const productItem = page.locator('button', { hasText: /Paracetamol/i }).first();
    await expect(productItem).toBeVisible({ timeout: 10000 });
    await productItem.click();

    // 2. Verificar que se agregó a la tabla del carrito
    await expect(page.locator('table').getByText(/Paracetamol/i).first()).toBeVisible();

    // 3. Emitir Factura Electrónica
    const emitirBtn = page.getByRole('button', { name: /Emitir Factura Electrónica/i });
    await emitirBtn.click();

    // 4. Modal de Facturación debe abrirse con estado AUTORIZADO
    await expect(page.locator('text=Factura Autorizada por el SRI')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${FAKE_CLAVE_ACCESO}`)).toBeVisible();

    // 5. Botón de RIDE debe estar disponible
    const rideBtn = page.getByRole('button', { name: /Ver \/ Descargar RIDE/i });
    await expect(rideBtn).toBeVisible();

    // Cerrar modal con botón de Nueva Venta
    const newSaleBtn = page.getByRole('button', { name: /Nueva Venta/i });
    await newSaleBtn.click();
  });

  test('E2E: Emisión de Devolución / Nota de Crédito (NC)', async ({ page }) => {
    // 1. Abrir modal de devolución
    const devolucionBtn = page.getByRole('button', { name: /Devolución \/ NC/i });
    await devolucionBtn.click();

    await expect(page.getByRole('heading', { name: /Emitir Nota de Crédito/i })).toBeVisible();

    // 2. Llenar clave de acceso de 49 dígitos
    const claveInput = page.locator('input[placeholder*="28092026"]');
    await claveInput.fill(FAKE_CLAVE_ACCESO);

    // 3. Confirmar emisión
    const submitBtn = page.getByRole('button', { name: /Emitir Nota de Crédito/i });
    await submitBtn.click();

    // 4. Verificar confirmación de Nota de Crédito emitida
    await expect(page.locator('text=Nota de Crédito Generada con Éxito')).toBeVisible();
    await expect(page.locator(`text=${FAKE_NC_CLAVE_ACCESO}`)).toBeVisible();
  });

  test('E2E: Reconciliación de comprobantes en contingencia con re-emisión', async ({ page }) => {
    // 1. Abrir modal de Reconciliación
    const reconciliarBtn = page.getByRole('button', { name: /Reconciliar/i });
    await reconciliarBtn.click();

    await expect(page.getByText('Reconciliación de Comprobantes SRI')).toBeVisible();
    await expect(page.getByText('EN_CONTINGENCIA')).toBeVisible();

    // 2. Re-emitir factura en contingencia
    const reemitirBtn = page.getByRole('button', { name: /Re-emitir Factura/i });
    await reemitirBtn.click();

    // 3. Verificar mensaje de confirmación
    await expect(page.getByText(/Factura re-emitida y encolada/i)).toBeVisible();
  });
});
