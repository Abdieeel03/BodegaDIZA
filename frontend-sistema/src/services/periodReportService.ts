import apiClient from '../api/axios';
import type { ApiResponse } from '../types';
import type { PeriodMode } from '../components/period/PeriodControls';

type HistoryRow = { fecha:string; id:string; nombre:string; cantidad:number; precio:number; stockFinal:number };
export type HistoryReport = {
  filas:number; unidades:number; ingresos:number; productos:number;
  tendencia:{periodo:string;unidades:number;ingresos:number}[];
  registros:HistoryRow[]; pagina:number; tamanio:number;
};
export type StockMovement = {
  id:number; productoId:number; productoNombre:string; productoSku:string;
  codigoLote:string|null; tipo:'ENTRADA'|'SALIDA'|'AJUSTE';
  cantidad:number; fecha:string; motivo:string|null; usuarioNombre:string;
};
const unwrap = <T,>(r:ApiResponse<T>):T => {
  if(!r.success || r.data === null) throw new Error(r.message||'No se pudieron cargar datos');
  return r.data;
};
export async function historyReport(range:{desde?:string;hasta?:string}, productoId:string, agrupacion:PeriodMode, pagina:number):Promise<HistoryReport> {
  const r=await apiClient.get<ApiResponse<HistoryReport>>('/test-data/reportes/ventas',{
    params:{...range,productoId:productoId||undefined,agrupacion:agrupacion==='todo'?'mes':agrupacion,pagina,tamanio:40},
  });
  return unwrap(r.data);
}
export async function stockMovements():Promise<StockMovement[]> {
  const r=await apiClient.get<ApiResponse<StockMovement[]>>('/inventario/movimientos');
  return unwrap(r.data);
}
