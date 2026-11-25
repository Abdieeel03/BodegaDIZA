import { test, expect, API_URL, dataOf, login, navigate, openSale, addItem, inventoryRow, stock, futureDate } from './fixtures.mjs';

for (const path of ['/inventario', '/ventas', '/prediccion-demanda']) {
  test(`AUTO-01: acceso sin sesión a ${path} redirige al login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).toBeVisible();
  });
}

test('AUTO-02: contraseña incorrecta es rechazada por la API', async ({ page }) => {
  const response = page.waitForResponse(r => r.url() === `${API_URL}/auth/login` && r.request().method() === 'POST');
  await login(page, 'incorrecta');
  expect((await response).status()).toBe(401);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('AUTO-03: login válido permite navegar y cerrar sesión', async ({ page }) => {
  await login(page);
  await navigate(page, 'Inventario');
  await expect(page).toHaveURL(/\/inventario$/);
  await page.getByLabel('Opciones del usuario Pruebas Automaticas').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/ventas');
  await expect(page).toHaveURL(/\/login$/);
});

test('AUTO-04: buscar por SKU y nombre devuelve el producto persistido', async ({ page, catalog }) => {
  await login(page);
  const row = await inventoryRow(page, catalog.normal);
  await expect(row.getByRole('cell', { name: catalog.normal.nombre, exact: true })).toBeVisible();
  await expect(row.locator('.inventory-stock')).toHaveText('10');
  await page.getByRole('searchbox', { name: 'Buscar por SKU o nombre' }).fill(catalog.normal.nombre);
  await expect(row).toBeVisible();
  await expect(page.locator('.inventory-table tbody tr')).toHaveCount(1);
});

test('AUTO-05: búsqueda sin coincidencias permite limpiar los filtros', async ({ page, catalog }) => {
  await login(page);
  await inventoryRow(page, catalog.normal);
  await page.getByRole('searchbox', { name: 'Buscar por SKU o nombre' }).fill('NO-EXISTE-ESTE-SKU');
  await expect(page.locator('.inventory-table')).toContainText('Sin resultados');
  await page.locator('.inventory-table').getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByRole('searchbox', { name: 'Buscar por SKU o nombre' })).toHaveValue('');
  await expect(page.locator('.inventory-table tbody tr').first()).not.toContainText('Sin resultados');
});

test('AUTO-06: filtros distinguen stock bajo de productos agotados', async ({ page, catalog }) => {
  await login(page);
  await navigate(page, 'Inventario');
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ label: catalog.category.nombre });
  await page.getByRole('combobox', { name: 'Estado de stock', exact: true }).selectOption('bajo');
  await expect(page.locator('.inventory-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.inventory-table')).toContainText(catalog.low.sku);
  await page.getByRole('combobox', { name: 'Estado de stock', exact: true }).selectOption('agotado');
  await expect(page.locator('.inventory-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.inventory-table')).toContainText(catalog.empty.sku);
});

test('AUTO-07: carrito vacío no permite registrar y excluye productos sin stock', async ({ page, catalog }) => {
  await login(page);
  await openSale(page);
  await expect(page.locator('form.diza-sale-form').getByRole('button', { name: 'Registrar venta' })).toBeDisabled();
  await expect(page.getByLabel('Producto con stock disponible').locator(`option[value="${catalog.empty.id}"]`)).toHaveCount(0);
  await page.getByRole('button', { name: 'Añadir producto' }).click();
  await expect(page.locator('form.diza-sale-form').getByRole('alert')).toContainText('Selecciona un producto');
});

for (const quantity of ['0', '-1', '0.0001']) {
  test(`AUTO-08: cantidad inválida ${quantity} no entra al carrito ni modifica stock`, async ({ page, api, catalog }) => {
    await login(page);
    await openSale(page);
    await addItem(page, catalog.normal, quantity);
    await expect(page.locator('form.diza-sale-form').getByRole('alert')).toContainText('hasta 3 decimales');
    await expect(page.getByRole('region', { name: 'Productos de la venta' }).getByRole('listitem')).toHaveCount(0);
    expect(await stock(api, catalog.normal)).toBe(10);
  });
}

test('AUTO-09: la suma de cantidades del mismo producto no puede superar el stock', async ({ page, api, catalog }) => {
  await login(page);
  await openSale(page);
  await addItem(page, catalog.normal, 6);
  await addItem(page, catalog.normal, 5);
  await expect(page.locator('form.diza-sale-form').getByRole('alert')).toContainText('ya tienes 6');
  await expect(page.getByRole('region', { name: 'Productos de la venta' }).getByRole('listitem')).toHaveCount(1);
  expect(await stock(api, catalog.normal)).toBe(10);
});

test('AUTO-10: quitar un producto vacía el carrito sin registrar ventas', async ({ page, api, catalog }) => {
  const before = await dataOf(await api.get('/ventas'));
  await login(page);
  await openSale(page);
  await addItem(page, catalog.normal, 2);
  await page.getByRole('button', { name: `Quitar ${catalog.normal.nombre} de la venta` }).click();
  await expect(page.locator('form.diza-sale-form').getByRole('button', { name: 'Registrar venta' })).toBeDisabled();
  expect(await stock(api, catalog.normal)).toBe(10);
  expect(await dataOf(await api.get('/ventas'))).toHaveLength(before.length);
});

test('AUTO-11: venta de varios productos confirma importe, ticket y stock en pantalla y API', async ({ page, api, catalog }, testInfo) => {
  await login(page);
  await openSale(page);
  await addItem(page, catalog.normal, 2);
  await addItem(page, catalog.normal, 1);
  await addItem(page, catalog.low, 1);
  await expect(page.getByRole('region', { name: 'Productos de la venta' }).getByRole('listitem')).toHaveCount(2);
  const response = page.waitForResponse(r => r.url() === `${API_URL}/ventas` && r.request().method() === 'POST');
  await page.locator('form.diza-sale-form').getByRole('button', { name: 'Registrar venta' }).click();
  const sale = await dataOf(await response, 201);
  expect(sale.total).toBe(16.5); // 3 × 4.50 + 1 × 3.00
  expect(sale.detalles).toHaveLength(2);
  await expect(page.getByRole('status').filter({ hasText: `Venta #${sale.id} registrada correctamente` })).toBeVisible();
  await page.getByText('Consultar tickets de venta', { exact: true }).click();
  await page.getByLabel('Buscar número de ticket').fill(String(sale.id));
  await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: `#${sale.id}`, exact: true }) })).toBeVisible();
  expect(await stock(api, catalog.normal)).toBe(7);
  expect(await stock(api, catalog.low)).toBe(1);
  const row = await inventoryRow(page, catalog.normal);
  await expect(row.locator('.inventory-stock')).toHaveText('7');
  await testInfo.attach('Inventario después de la venta', { body: await page.screenshot(), contentType: 'image/png' });
});

test('AUTO-12: vender cantidad decimal conserva precisión y genera salida de inventario', async ({ page, api, catalog }) => {
  await login(page);
  await openSale(page);
  await addItem(page, catalog.normal, '0.500');
  const response = page.waitForResponse(r => r.url() === `${API_URL}/ventas` && r.request().method() === 'POST');
  await page.locator('form.diza-sale-form').getByRole('button', { name: 'Registrar venta' }).click();
  expect((await dataOf(await response, 201)).total).toBe(2.25);
  expect(await stock(api, catalog.normal)).toBe(9.5);
  const movements = await dataOf(await api.get(`/inventario/movimientos?productoId=${catalog.normal.id}&tipo=SALIDA`));
  expect(movements).toHaveLength(1);
  expect(movements[0].cantidad).toBe(0.5);
});

test('AUTO-13: la API rechaza una venta sin JWT', async ({ request, api, catalog }) => {
  const response = await request.post(`${API_URL}/ventas`, { data: { items: [{ productoId: catalog.normal.id, cantidad: 1 }] } });
  expect(response.status()).toBe(401);
  expect(await stock(api, catalog.normal)).toBe(10);
});

test('AUTO-14: una venta con un ítem sin stock no deja descuentos ni tickets parciales', async ({ api, catalog }) => {
  const before = await dataOf(await api.get('/ventas'));
  const response = await api.post('/ventas', { data: { items: [
    { productoId: catalog.normal.id, cantidad: 2 },
    { productoId: catalog.low.id, cantidad: 3 },
  ] } });
  expect(response.status()).toBe(400);
  expect((await response.json()).message).toContain('Stock insuficiente');
  expect(await stock(api, catalog.normal)).toBe(10);
  expect(await stock(api, catalog.low)).toBe(2);
  expect(await dataOf(await api.get('/ventas'))).toHaveLength(before.length);
  expect(await dataOf(await api.get(`/inventario/movimientos?productoId=${catalog.normal.id}&tipo=SALIDA`))).toHaveLength(0);
});

test('AUTO-15: validaciones HTTP rechazan cantidad cero y SKU duplicado', async ({ api, catalog }) => {
  const sale = await api.post('/ventas', { data: { items: [{ productoId: catalog.normal.id, cantidad: 0 }] } });
  expect(sale.status()).toBe(400);
  expect((await sale.json()).success).toBe(false);
  const duplicate = await api.post('/productos', { data: catalog.normal.payload });
  expect(duplicate.status()).toBe(400);
  expect((await duplicate.json()).success).toBe(false);
  const matches = await dataOf(await api.get(`/productos?search=${catalog.normal.sku}`));
  expect(matches).toHaveLength(1);
  expect(await stock(api, catalog.normal)).toBe(10);
});

test('AUTO-16: FEFO consume primero el lote con vencimiento más cercano', async ({ api, catalog }) => {
  const product = catalog.normal;
  await dataOf(await api.post('/inventario/entradas', { data: {
    productoId: product.id, codigoLote: 'LOTE-CERCANO', cantidad: 2,
    fechaVencimiento: futureDate(5), motivo: 'Entrada sintética E2E',
  } }));
  const sale = await dataOf(await api.post('/ventas', { data: { items: [{ productoId: product.id, cantidad: 3 }] } }), 201);
  expect(sale.detalles.map(d => [d.codigoLote, d.cantidad])).toEqual([['LOTE-CERCANO', 2], ['LOTE-NORMAL', 1]]);
  expect(await stock(api, product)).toBe(9);
});
