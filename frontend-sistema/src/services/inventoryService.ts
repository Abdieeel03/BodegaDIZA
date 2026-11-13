import apiClient from '../api/axios';
import type { InventoryProduct } from '../types/inventory';

/**
 * Lectura de productos del backend real BodegaDIZA.
 * Contrato verificado: GET /productos -> { success, data: ProductoResponse[] }.
 * GET /productos incluye stockTotal y categoria.nombre, pero NO precioCosto.
 * La API solo se consulta si VITE_INVENTORY_MODE=api en .env.local.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`El servidor devolvió un producto sin ${field}.`);
  }
  return value;
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`El servidor devolvió un valor inválido en ${field}.`);
  }
  return value;
}

function parseProduct(value: unknown): InventoryProduct {
  if (!isRecord(value)) {
    throw new Error('El servidor devolvió un producto con formato incorrecto.');
  }
  if (!isRecord(value.categoria)) {
    throw new Error('El producto no tiene una categoría válida.');
  }

  return {
    sku: readText(value.sku, 'sku'),
    nombre: readText(value.nombre, 'nombre'),
    categoria: readText(value.categoria.nombre, 'categoria.nombre'),
    stock: readNumber(value.stockTotal, 'stockTotal'),
    stockMinimo: readNumber(value.stockMinimo, 'stockMinimo'),
    // El DTO /productos no entrega precio de costo. No inventar valores.
    precioCosto: null,
    precioVenta: readNumber(value.precioVenta, 'precioVenta'),
  };
}

export async function listInventoryProducts(signal: AbortSignal): Promise<InventoryProduct[]> {
  const endpoint =
    (import.meta.env.VITE_INVENTORY_ENDPOINT as string | undefined)?.trim() || '/productos';

  if (!endpoint.startsWith('/') || endpoint.startsWith('//')) {
    throw new Error('VITE_INVENTORY_ENDPOINT debe ser una ruta de la API, por ejemplo /productos.');
  }

  // apiClient incorpora automáticamente Authorization: Bearer <JWT>.
  const response = await apiClient.get<unknown>(endpoint, {
    signal,
    params: { soloActivos: true },
  });
  const body = response.data;
  if (!isRecord(body)) {
    throw new Error('El servidor no devolvió la respuesta JSON esperada.');
  }
  if (body.success === false) {
    throw new Error(typeof body.message === 'string' ? body.message : 'No se pudo consultar productos.');
  }
  if (body.success !== true || !Array.isArray(body.data)) {
    throw new Error('Formato inesperado: se esperaba { success: true, data: [] }.');
  }
  return body.data.map(parseProduct);
}
