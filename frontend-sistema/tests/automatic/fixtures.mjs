import { randomUUID, randomInt } from 'node:crypto';
import { test as base, expect } from '@playwright/test';

export const API_URL = 'http://127.0.0.1:18081';
export const credentials = { email: 'e2e@diza.invalid', password: 'Diza-E2E-temporal-123' };

export async function dataOf(response, expectedStatus = 200) {
  expect(response.status(), await response.text()).toBe(expectedStatus);
  const body = await response.json();
  expect(body.success).toBe(true);
  return body.data;
}

export const test = base.extend({
  api: [async ({ playwright }, provide) => {
    const guest = await playwright.request.newContext({ baseURL: API_URL });
    let auth;
    // Tomcat puede aceptar peticiones antes de terminar BootstrapAdmin.
    await expect(async () => {
      auth = await dataOf(await guest.post('/auth/login', { data: credentials }));
    }).toPass({ timeout: 15_000 });
    await guest.dispose();
    const api = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${auth.token}` },
    });
    try { await provide(api); } finally { await api.dispose(); }
  }, { scope: 'worker', auto: true }],

  catalog: async ({ api }, provide) => {
    const suffix = randomUUID().slice(0, 8);
    const category = await dataOf(await api.post('/categorias', {
      data: { nombre: `Categoría E2E ${suffix}`, descripcion: 'Datos sintéticos' },
    }), 201);
    const supplier = await dataOf(await api.post('/proveedores', {
      data: { nombre: `Proveedor E2E ${suffix}`, ruc: String(randomInt(10000000000, 99999999999)), email: 'proveedor@diza.invalid' },
    }), 201);
    const create = async (label, stock, price = 4.5) => {
      const payload = {
        sku: `E2E-${suffix}-${label}`, nombre: `Producto ${label} ${suffix}`,
        categoriaId: category.id, proveedorId: supplier.id,
        precioVenta: price, stockMinimo: 5, unidadMedida: 'UNIDAD',
        loteInicial: stock > 0 ? { codigoLote: `LOTE-${label}`, cantidad: stock, fechaVencimiento: futureDate(30) } : null,
      };
      return { ...await dataOf(await api.post('/productos', { data: payload }), 201), payload };
    };
    const normal = await create('NORMAL', 10);
    const low = await create('BAJO', 2, 3);
    const empty = await create('AGOTADO', 0);
    await provide({ normal, low, empty, category, create });
    // La BD completa desaparece al detener bootE2e. Cada caso usa SKUs únicos.
  },
});

export { expect };

export function futureDate(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function login(page, password = credentials.password) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(credentials.email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar al sistema' }).click();
  if (password === credentials.password) {
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Inicio', exact: true }).first()).toBeVisible();
  }
}

export async function navigate(page, name) {
  await page.getByRole('navigation', { name: 'Secciones del sistema', exact: true })
    .getByRole('link', { name, exact: true }).click();
}

export async function openSale(page) {
  await navigate(page, 'Ventas');
  await page.getByRole('button', { name: 'Registrar venta', exact: true }).click();
  await expect(page.getByLabel('Producto con stock disponible')).toBeEnabled();
}

export async function addItem(page, product, quantity) {
  await page.getByLabel('Producto con stock disponible').selectOption(String(product.id));
  await page.getByRole('spinbutton', { name: 'Cantidad' }).fill(String(quantity));
  await page.getByRole('button', { name: 'Añadir producto' }).click();
}

export async function inventoryRow(page, product) {
  await navigate(page, 'Inventario');
  await page.getByRole('searchbox', { name: 'Buscar por SKU o nombre' }).fill(product.sku);
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: product.sku, exact: true }) });
  await expect(row).toHaveCount(1);
  return row;
}

export async function stock(api, product) {
  return (await dataOf(await api.get(`/productos/${product.id}`))).stockTotal;
}
