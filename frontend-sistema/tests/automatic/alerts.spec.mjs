import { test, expect, login, navigate, dataOf, futureDate } from './fixtures.mjs';

const list = page => page.getByRole('region', { name: 'Notificaciones operativas' });
const noML = page => page.route('**/ml/trainings/latest', route => route.fulfill({ status: 503, json: { success: false, data: null, message: 'Servicio no disponible' } }));

test('AL-01: alertas de stock sin ML y resolución después de reposición', async ({ page, api, catalog }) => {
  await noML(page);
  await login(page);
  await navigate(page, 'Alertas');
  await expect(page.getByText('Predicción no disponible en este momento.', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('stock');
  await page.getByRole('searchbox', { name: 'Buscar producto, SKU o lote' }).fill(catalog.low.sku);
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
  await expect(list(page)).toContainText(`Stock bajo: ${catalog.low.nombre}`);
  await expect(list(page).getByRole('link', { name: 'Reponer' })).toHaveAttribute('href', new RegExp(`sku=${catalog.low.sku}`));
  await dataOf(await api.post('/inventario/entradas', { data: { productoId: catalog.low.id, codigoLote: 'AL-REPOSICION', cantidad: 8, fechaVencimiento: futureDate(90), motivo: 'Prueba de alertas' } }));
  await page.getByRole('button', { name: 'Recargar alertas' }).click();
  await expect(list(page)).not.toContainText(`Stock bajo: ${catalog.low.nombre}`);
  await expect(list(page)).toContainText('No hay alertas con esos filtros');
});

test('AL-02: alertas de vencimiento, filtro y enlace exacto de lote', async ({ page, catalog }) => {
  await noML(page);
  const base = { productoId: catalog.normal.id, productoNombre: catalog.normal.nombre, productoSku: catalog.normal.sku, productoCategoria: catalog.category.nombre, cantidadDisponible: 2, fechaIngreso: futureDate(-5), vencido: false, precisionVencimiento: 'EXACTA', mesVencimiento: null, vendible: true, fechaHeredada: false, advertencia: null, version: 0, permiteSinVencimiento: false };
  const lots = [
    { ...base, id: 90001, codigoLote: 'AL-CRITICO', fechaVencimiento: futureDate(2), diasParaVencer: 2, estadoVencimiento: 'CRITICO' },
    { ...base, id: 90002, codigoLote: 'AL-PREVENTIVO', fechaVencimiento: futureDate(12), diasParaVencer: 12, estadoVencimiento: 'PREVENTIVO' },
    { ...base, id: 90003, codigoLote: 'AL-PENDIENTE', fechaVencimiento: null, diasParaVencer: null, estadoVencimiento: 'PENDIENTE', precisionVencimiento: 'PENDIENTE', vendible: false },
  ];
  await page.route('**/inventario/alertas/vencimiento?*', route => route.fulfill({ json: { success: true, data: lots } }));
  await login(page);
  await navigate(page, 'Alertas');
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('expiry');
  await page.getByRole('combobox', { name: 'Prioridad', exact: true }).selectOption('preventive');
  await expect(list(page).getByRole('listitem')).toHaveCount(1);
  await expect(list(page)).toContainText('AL-PREVENTIVO');
  await list(page).getByRole('link', { name: 'Revisar lote' }).click();
  await expect(page).toHaveURL(/loteId=90002/);
  await expect(page.getByLabel('Horizonte', { exact: true })).toHaveValue('0');
  await expect(page.locator('.diza-expiry-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.diza-expiry-table tbody')).toContainText('AL-PREVENTIVO');
  await expect(page.locator('.diza-expiry-table tbody')).not.toContainText('AL-CRITICO');
});

test('AL-03: un pronóstico vencido no genera alertas predictivas', async ({ page }) => {
  await page.route('**/ml/trainings/latest', route => route.fulfill({ json: { success: true, data: { forecastFromDate: '2020-01-01', forecastToDate: '2020-01-07' } } }));
  await login(page);
  await navigate(page, 'Alertas');
  await expect(page.getByText('El horizonte predictivo no está vigente.', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'Tipo', exact: true }).selectOption('prediction');
  await expect(list(page).getByRole('listitem')).toHaveCount(0);
});
