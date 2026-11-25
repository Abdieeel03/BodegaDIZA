import { test, expect } from '@playwright/test';

const email = process.env.E2E_EMAIL || '';
const password = process.env.E2E_PASSWORD || '';

// La sesión vive en memoria: una recarga completa pierde el JWT.
async function navigate(page, path) {
  const names = { '/inventario': 'Inventario', '/ventas': 'Ventas', '/prediccion-demanda': 'Predicción de demanda', '/prediccion-demanda/reposicion': 'Reposición' };
  await page.getByRole('navigation', { name: 'Secciones del sistema', exact: true })
    .getByRole('link', { name: names[path], exact: true }).click();
}

async function login(page) {
  if (!email || !password) throw new Error('Configura E2E_EMAIL y E2E_PASSWORD como variables de entorno para la cuenta de PRUEBAS.');
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Entrar al sistema' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Inicio', exact: true }).first()).toBeVisible();
}

async function stockForSku(page, sku) {
  await navigate(page, '/inventario');
  await expect(page.getByRole('heading', { name: 'Inventario', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar por SKU o nombre' }).fill(sku);
  const row = page.locator('.inventory-table tbody tr').filter({ has: page.locator('td.inventory-sku', { hasText: sku }) }).first();
  await expect(row).toBeVisible();
  const raw = (await row.locator('td').nth(3).innerText()).trim().replaceAll(' ', '').replace(',', '.');
  const stock = Number(raw);
  expect(Number.isFinite(stock), `Stock no numérico para ${sku}: ${raw}`).toBeTruthy();
  return stock;
}

test('PF-01: ruta protegida redirige al login', async ({ page }) => {
  await page.goto('/inventario');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).toBeVisible();
});

test('PF-02: credenciales incorrectas no permiten el ingreso', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-email').fill('no-existe-e2e@ejemplo.invalid');
  await page.locator('#login-password').fill('clave-incorrecta-e2e');
  await page.getByRole('button', { name: 'Entrar al sistema' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test('PF-03: ingreso válido y pantalla de inicio', async ({ page }) => {
  await login(page);
});

test('PF-04: inventario permite buscar un SKU real', async ({ page }) => {
  await login(page);
  await navigate(page, '/inventario');
  const firstRow = page.locator('.inventory-table tbody tr').filter({ has: page.locator('td.inventory-sku') }).first();
  await expect(firstRow).toBeVisible();
  const sku = (await firstRow.locator('td').first().innerText()).trim();
  expect(sku).not.toBe('');
  await page.getByRole('searchbox', { name: 'Buscar por SKU o nombre' }).fill(sku);
  await expect(page.locator('.inventory-table tbody tr').filter({ hasText: sku }).first()).toBeVisible();
});

test('PF-05: módulo predictivo muestra pronósticos', async ({ page }) => {
  await login(page);
  await navigate(page, '/prediccion-demanda');
  await expect(page.getByRole('heading', { name: 'Predicción de demanda', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resumen del modelo' }).or(page.locator('[aria-label="Resumen del modelo"]'))).toBeVisible();
  await expect(page.getByText('Demanda estimada · 7 días')).toBeVisible();
  await navigate(page, '/prediccion-demanda/reposicion');
  await expect(page.getByRole('heading', { name: 'Qué necesitas reponer' })).toBeVisible();
});

test('PF-06: validar rechazo de cantidad mayor al stock sin registrar venta', async ({ page }) => {
  await login(page);
  await navigate(page, '/ventas');
  await page.getByRole('button', { name: 'Registrar venta' }).first().click();
  const select = page.locator('#sale-product');
  await expect(select).toBeEnabled();
  const option = await select.locator('option').evaluateAll(nodes => nodes.find(node => node.value !== '')?.value || '');
  test.skip(!option, 'La base de prueba no tiene productos con stock disponible');
  await select.selectOption(option);
  await page.locator('#sale-amount').fill('999999');
  await page.getByRole('button', { name: 'Añadir producto' }).click();
  await expect(page.locator('.diza-sale-form [role="alert"]')).toContainText('stock');
});

test('PF-07: registrar 1 unidad y verificar descuento real de stock [solo base de prueba]', async ({ page }, testInfo) => {
  test.skip(process.env.E2E_ALLOW_SALE !== 'SI_SOLO_BD_TEST', 'Prueba de escritura desactivada; establecer E2E_ALLOW_SALE=SI_SOLO_BD_TEST solo después de comprobar conexión a la BD bodega_diza_test.');
  await login(page);
  await navigate(page, '/ventas');
  await page.getByRole('button', { name: 'Registrar venta' }).first().click();
  const select = page.locator('#sale-product');
  await expect(select).toBeEnabled();
  const options = await select.locator('option').evaluateAll(nodes => nodes
    .filter(node => node.value && /\bStock\s+[\d.,]+/i.test(node.textContent || ''))
    .map(node => ({ value: node.value, label: node.textContent || '' })));
  const chosen = options.find(x => /\bStock\s+([2-9]|\d\d)/.test(x.label)) || options[0];
  test.skip(!chosen, 'No existen productos vendibles en la base de prueba');
  const sku = chosen.label.split(' · ')[0].trim();
  const before = await stockForSku(page, sku);
  expect(before, `Stock insuficiente de ${sku}`).toBeGreaterThanOrEqual(1);
  await testInfo.attach('Stock antes de la venta', { body: await page.screenshot(), contentType: 'image/png' });
  await navigate(page, '/ventas');
  await page.getByRole('button', { name: 'Registrar venta' }).first().click();
  await page.locator('#sale-product').selectOption(chosen.value);
  await page.locator('#sale-amount').fill('1');
  await page.getByRole('button', { name: 'Añadir producto' }).click();
  await page.locator('form.diza-sale-form').getByRole('button', { name: 'Registrar venta' }).click();
  await expect(page.getByText(/Venta #\d+ registrada correctamente/)).toBeVisible();
  await testInfo.attach('Venta registrada', { body: await page.screenshot(), contentType: 'image/png' });
  const after = await stockForSku(page, sku);
  expect(after, `El stock de ${sku} debía disminuir 1 unidad`).toBeCloseTo(before - 1, 3);
  await testInfo.attach('Stock después de la venta', { body: await page.screenshot(), contentType: 'image/png' });
});
