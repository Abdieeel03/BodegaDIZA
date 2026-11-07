import apiClient from '../api/axios';
import type { InventoryProduct } from '../types/inventory';

/**
 * Servicio de lectura preparado para un endpoint futuro de Inventario.
 * IMPORTANTE: el contrato del backend aún no está confirmado.
 * No activa llamadas HTTP por sí solo: InventoryPage usa modo demo por defecto.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Respuesta de inventario inválida: falta ${field}.`);
  }
  return value;
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Respuesta de inventario inválida: ${field} debe ser un número mayor o igual a cero.`);
  }
  return value;
}

/** Punto central para ajustar el mapeo cuando el backend confirme su DTO. */
function parseProduct(value: unknown): InventoryProduct {
  if (!isRecord(value)) throw new Error('El servidor devolvió un producto con formato incorrecto.');

  return {
    sku: readText(value.sku, 'sku'),
    nombre: readText(value.nombre, 'nombre'),
    categoria: readText(value.categoria, 'categoria'),
    stock: readNumber(value.stock, 'stock'),
    stockMinimo: readNumber(value.stockMinimo, 'stockMinimo'),
    precioCosto: readNumber(value.precioCosto, 'precioCosto'),
    precioVenta: readNumber(value.precioVenta, 'precioVenta'),
  };
}

function parseList(body: unknown): InventoryProduct[] {
  if (isRecord(body) && body.success === false) {
    throw new Error(typeof body.message === 'string' ? body.message : 'La API devolvió un error de inventario.');
  }

  let list: unknown = body;
  if (isRecord(body) && 'data' in body) list = body.data;
  // Admite arreglo directo, {data: []}, {content: []} o {data: {content: []}}.
  if (isRecord(list) && 'content' in list) list = list.content;

  if (!Array.isArray(list)) {
    throw new Error('La API no devolvió una lista de productos. Revisar el formato del endpoint.');
  }
  return list.map(parseProduct);
}

export async function listInventoryProducts(signal: AbortSignal): Promise<InventoryProduct[]> {
  const endpoint = (import.meta.env.VITE_INVENTORY_ENDPOINT as string | undefined)?.trim();
  if (!endpoint || !endpoint.startsWith('/') || endpoint.startsWith('//')) {
    throw new Error('Configura VITE_INVENTORY_ENDPOINT con la ruta real del backend, por ejemplo /ruta-confirmada.');
  }
  // Reutiliza el apiClient existente: baseURL y JWT se gestionan allí.
  const response = await apiClient.get<unknown>(endpoint, { signal });
  return parseList(response.data);
}
