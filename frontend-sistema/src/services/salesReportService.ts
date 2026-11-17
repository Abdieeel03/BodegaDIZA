import apiClient from '../api/axios';
import type { ApiResponse } from '../types';

export type SalesOrigin = 'todos' | 'historico' | 'operativo';
export type SalesGrouping = 'dia' | 'semana' | 'mes';
export type SalesReportFilters = {
  desde?: string; hasta?: string; sku?: string;
  origen?: SalesOrigin; agrupacion?: SalesGrouping; pagina?: number;
};
export type SalesPoint = { periodo: string; historico: number | null; operativo: number | null };
export type SalesReport = {
  total: number | null; historico: number; operativo: number; tickets: number;
  productos: number; coincidencias: number; historicoDisponible: boolean;
  tendencia: SalesPoint[];
  registros: { fecha: string; sku: string; nombre: string; origen: Exclude<SalesOrigin, 'todos'>;
    cantidad: number; unidad: string | null; importe: number; stockCierre: number | null }[];
  catalogo: { sku: string; nombre: string }[];
  ranking: { sku: string; nombre: string; importe: number }[];
  filas: number; pagina: number; tamanio: number;
};

export async function getSalesReport(filters: SalesReportFilters, signal?: AbortSignal): Promise<SalesReport> {
  const { data } = await apiClient.get<ApiResponse<SalesReport>>('/reportes/ventas', {
    params: { ...filters, sku: filters.sku || undefined }, signal,
  });
  if (!data.success || !data.data) throw new Error(data.message || 'No se pudo consultar el reporte de ventas.');
  return data.data;
}

export function peruToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export const salesDateLabel = (date: string, grouping: SalesGrouping = 'dia') =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('es-PE', {
    timeZone: 'America/Lima', ...(grouping === 'mes' ? {} : { day: 'numeric' as const }),
    month: 'short', year: 'numeric',
  });
