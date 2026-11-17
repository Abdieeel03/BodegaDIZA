import apiClient from '../api/axios';
import type { ApiResponse } from '../types';

/** Contratos existentes en GET /inventario/alertas/* (backend BodegaDIZA). */
export type StockAlert = {
  productoId: number;
  sku: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  deficit: number;
  unidadMedida: string;
};

export type ExpiringLot = {
  id: number;
  productoId: number;
  productoNombre: string;
  productoSku: string;
  codigoLote: string;
  cantidadDisponible: number;
  fechaIngreso: string;
  fechaVencimiento: string;
  vencido: boolean;
  diasParaVencer: number;
};

function extract<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data === null) {
    throw new Error(response.message || 'No se pudieron obtener las alertas de inventario.');
  }
  return response.data;
}

export async function getLowStockAlerts(): Promise<StockAlert[]> {
  const response = await apiClient.get<ApiResponse<StockAlert[]>>('/inventario/alertas/bajo-stock');
  return extract(response.data);
}

/** El backend usa siete días por defecto, por eso se envía expresamente 30. */
export async function getExpiryAlerts(days = 30): Promise<ExpiringLot[]> {
  const response = await apiClient.get<ApiResponse<ExpiringLot[]>>('/inventario/alertas/vencimiento', {
    params: { dias: days },
  });
  return extract(response.data);
}
