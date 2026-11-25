import { test, expect, dataOf, login, navigate, API_URL, inventoryRow } from './fixtures.mjs';

const pending = { precision: 'PENDIENTE', fecha: null, mes: null };
const businessDate = days => {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
  const date = new Date(`${local}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const exact = days => ({ precision: 'EXACTA', fecha: businessDate(days), mes: null });
async function receive(api, product, code, vencimiento, cantidad = 5) {
  return dataOf(await api.post('/inventario/entradas', { data: { productoId: product.id, codigoLote: code, cantidad, vencimiento } }));
}

test('LOT-01: recepción múltiple desde interfaz conserva precisión y stock', async ({ page, api, catalog }) => {
  await login(page);
  const row = await inventoryRow(page, catalog.empty);
  await row.getByRole('link', { name: 'Reponer', exact: true }).click();
  await page.getByRole('textbox', { name: 'Código de lote', exact: true }).fill('PENDIENTE');
  await expect(page.getByLabel('Tipo de vencimiento')).toHaveValue('EXACTA');
  await page.getByLabel('Tipo de vencimiento').selectOption('PENDIENTE');
  await page.getByLabel('Cantidad a ingresar').fill('2.125');
  await page.getByRole('button', { name: 'Añadir otro lote' }).click();
  const extra = page.getByRole('region', { name: 'Lote adicional 2' });
  await extra.getByLabel('Código de lote').fill('MES');
  await extra.getByLabel('Cantidad a ingresar').fill('3.375');
  await extra.getByLabel('Tipo de vencimiento').selectOption('MES_ANIO');
  await extra.getByLabel('Mes y año').fill('2027-06');
  await page.getByRole('button', { name: 'Registrar entrada', exact: true }).click();
  await expect(page).toHaveURL(/\/inventario$/);
  const product = await dataOf(await api.get(`/productos/${catalog.empty.id}`));
  expect(product.stockFisico).toBe(5.5);
  expect(product.stockVendible).toBe(0);
  const lots = await dataOf(await api.get(`/inventario/lotes?productoId=${product.id}`));
  expect(lots).toHaveLength(2);
  expect(lots.find(l => l.codigoLote === 'MES')).toMatchObject({ mesVencimiento: '2027-06', fechaVencimiento: null, vendible: false });
});

test('LOT-02: horizontes, estados y búsquedas incluyen vencidos y pendientes', async ({ page, api, catalog }) => {
  for (const day of [-1, 0, 2, 5, 10, 20, 60, 100]) await receive(api, catalog.empty, `D${day}`, exact(day));
  await receive(api, catalog.empty, 'PENDIENTE', pending);
  await login(page);
  await navigate(page, 'Próximos a vencer');
  await page.getByRole('searchbox').fill(catalog.empty.sku);
  const rows = page.locator('.diza-expiry-table tbody tr');
  for (const [horizon, count] of [[7, 5], [15, 6], [30, 7], [90, 8], [0, 9]]) {
    await page.getByLabel('Horizonte').selectOption(String(horizon));
    await expect(rows).toHaveCount(count);
    await expect(page.locator('.diza-expiry-table')).toContainText('Vencido');
    await expect(page.locator('.diza-expiry-table')).toContainText('Pendiente de verificación');
  }
  for (const state of ['VENCIDO', 'HOY', 'CRITICO', 'PROXIMO', 'PENDIENTE']) {
    await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption(state);
    await expect(rows).toHaveCount(1);
  }
  await page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('all');
  await page.getByRole('searchbox').fill(catalog.category.nombre);
  await expect(rows).toHaveCount(11); // dos lotes iniciales del fixture + nueve nuevos
  await page.getByRole('searchbox').fill('NO-EXISTE');
  await expect(page.getByText('No hay lotes con esos filtros')).toBeVisible();
});

for (const width of [1280, 390]) {
  test(`LOT-03: regularizar y dividir sin perder stock en ${width}px`, async ({ page, api, catalog }, testInfo) => {
    const lot = await receive(api, catalog.empty, 'POR-VERIFICAR', pending, 8.5);
    await login(page);
    await navigate(page, 'Próximos a vencer');
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('searchbox').fill(catalog.empty.sku);
    await page.getByRole('button', { name: 'Regularizar', exact: true }).filter({ visible: true }).click();
    await page.getByRole('checkbox', { name: 'Dividir lote' }).check();
    await page.getByLabel('Cantidad a regularizar').fill('3.125');
    await page.getByLabel('Código del nuevo lote').fill('VERIFICADO');
    await page.getByLabel('Tipo de vencimiento').selectOption('EXACTA');
    await page.getByLabel('Fecha de vencimiento').fill(businessDate(3));
    await page.getByLabel('Motivo de la corrección').fill('Etiqueta revisada en recepción');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach(`Regularización ${width}px`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    await page.getByRole('button', { name: 'Confirmar regularización' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Cambios registrados' })).toBeVisible();
    const product = await dataOf(await api.get(`/productos/${catalog.empty.id}`));
    expect(product.stockFisico).toBe(8.5);
    expect(product.stockVendible).toBe(3.125);
    expect(await dataOf(await api.get(`/inventario/regularizaciones?loteId=${lot.id}`))).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach(`Vencimientos ${width}px`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
}

test('LOT-04: no aplica requiere política; API valida y revierte entradas', async ({ api, catalog, request }) => {
  const none = { precision: 'NO_APLICA', fecha: null, mes: null };
  expect((await api.post('/inventario/entradas', { data: { productoId: catalog.empty.id, codigoLote: 'SIN', cantidad: 1, vencimiento: none } })).status()).toBe(400);
  await dataOf(await api.post('/inventario/politica-vencimiento', { data: { productoId: catalog.empty.id, permiteSinVencimiento: true, motivo: 'Utensilio durable sin fecha de caducidad' } }));
  const lot = await receive(api, catalog.empty, 'SIN', none);
  expect(lot.vendible).toBe(true);
  const invalid = await api.post('/inventario/recepciones', { data: { lotes: [
    { productoId: catalog.empty.id, codigoLote: 'NUEVO', cantidad: 1, vencimiento: pending },
    { productoId: catalog.empty.id, codigoLote: 'SIN', cantidad: 1, vencimiento: exact(5) },
  ] } });
  expect(invalid.status()).toBe(400);
  expect(await dataOf(await api.get(`/inventario/lotes?productoId=${catalog.empty.id}`))).toHaveLength(1);
  const regularization = { loteId: lot.id, version: lot.version, cantidad: 1, nuevoCodigoLote: 'HIJO', vencimiento: pending, motivo: 'Revisar' };
  expect((await request.post(`${API_URL}/inventario/regularizaciones`, { data: regularization })).status()).toBe(401);
  expect((await api.post('/inventario/regularizaciones', { data: { ...regularization, cantidad: 0.0001 } })).status()).toBe(400);
});

test('LOT-05: carga y error de vencimientos permiten reintentar', async ({ page }) => {
  await login(page);
  await page.route('**/inventario/alertas/vencimiento?*', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Servicio de inventario no disponible' }) });
  });
  await navigate(page, 'Próximos a vencer');
  await expect(page.getByText('Consultando lotes próximos a vencer')).toBeVisible();
  await expect(page.getByText('No se pudieron consultar los vencimientos')).toBeVisible();
  await expect(page.getByText('Servicio de inventario no disponible')).toBeVisible();
});
