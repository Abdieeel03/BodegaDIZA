import apiClient from '../api/axios';

type Respuesta<T> = { success: boolean; data: T; message?: string | null };
export type TipoCsv = 'productos' | 'ventas' | 'predicciones';
export type ResumenHistorico = {
  productos: number;
  ventasDiarias: number;
  predicciones: number;
  desde: string | null;
  hasta: string | null;
  unidades: number;
  ingresos: number;
  origen: string;
};
export type ProductoHistorico = {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  stockMinimo: number;
  alerta: string;
};
export type TopProducto = { id: string; nombre: string; unidades: number; ingresos: number };
export type VentaDiaria = {
  fecha: string;
  id: string;
  nombre: string;
  cantidad: number;
  precio: number;
  stockFinal: number;
};
export type Prediccion = {
  historico: { fecha: string; ventas: number }[];
  predicciones: { fecha: string; real: number | null; prediccion: number; periodo: 'EVALUACION' | 'FUTURO' }[];
  metricas: { n: number; mae: number; rmse: number };
};
export type ProductoOperativo = {
  id: number;
  sku: string;
  nombre: string;
  precioVenta: number;
  stockTotal: number;
  activo: boolean;
  unidadMedida?: string;
};
export type DetalleVentaOperativa = {
  id: number;
  productoId: number;
  productoNombre: string;
  productoSku: string;
  cantidad: number;
  subtotal: number;
};
/** GET /ventas incluye detalles por ticket; opcional para conservar compatibilidad. */
export type VentaOperativa = {
  id: number;
  fecha: string;
  total: number;
  detalles?: DetalleVentaOperativa[];
};

const dato = <T>(respuesta: Respuesta<T>): T => {
  if (!respuesta.success) throw new Error(respuesta.message || 'La API rechazó la solicitud');
  return respuesta.data;
};

export async function resumenHistorico(): Promise<ResumenHistorico> {
  const r = await apiClient.get<Respuesta<ResumenHistorico>>('/test-data/resumen');
  return dato(r.data);
}
export async function productosHistoricos(): Promise<ProductoHistorico[]> {
  const r = await apiClient.get<Respuesta<ProductoHistorico[]>>('/test-data/productos');
  return dato(r.data);
}
export async function topProductos(): Promise<TopProducto[]> {
  const r = await apiClient.get<Respuesta<TopProducto[]>>('/test-data/top');
  return dato(r.data);
}
export async function ventasDiarias(productoId = ''): Promise<VentaDiaria[]> {
  const r = await apiClient.get<Respuesta<VentaDiaria[]>>('/test-data/ventas-diarias', {
    params: productoId ? { productoId } : undefined,
  });
  return dato(r.data);
}
export async function prediccionProducto(productoId: string): Promise<Prediccion> {
  const r = await apiClient.get<Respuesta<Prediccion>>('/test-data/prediccion', { params: { productoId } });
  return dato(r.data);
}
export async function importarCsv(tipo: TipoCsv, archivo: File): Promise<{ filasImportadas: number; destino: string }> {
  const form = new FormData();
  form.append('archivo', archivo);
  const r = await apiClient.post<Respuesta<{ filasImportadas: number; destino: string }>>(
    '/test-data/importar', form, {
      params: { tipo },
      // Axios detecta FormData en el navegador y añade el boundary correcto.
      headers: { 'Content-Type': undefined },
    }
  );
  return dato(r.data);
}

export async function productosOperativos(): Promise<ProductoOperativo[]> {
  const r = await apiClient.get<Respuesta<ProductoOperativo[]>>('/productos');
  return dato(r.data);
}
export async function ventasOperativas(range?: { desde?: string; hasta?: string }, signal?: AbortSignal): Promise<VentaOperativa[]> {
  const r = await apiClient.get<Respuesta<VentaOperativa[]>>('/ventas', { params: range, signal });
  return dato(r.data);
}
export type SaleItemPayload = { productoId: number; cantidad: number };

/** El backend acepta varios productos en un mismo POST /ventas. */
export async function registrarVentaConItems(items: SaleItemPayload[]): Promise<VentaOperativa> {
  if (!items.length) throw new Error('La venta debe incluir al menos un producto.');
  const r = await apiClient.post<Respuesta<VentaOperativa>>('/ventas', { items });
  return dato(r.data);
}

/** Se conserva el contrato anterior para otras pantallas que lo utilicen. */
export async function registrarVenta(productoId: number, cantidad: number): Promise<VentaOperativa> {
  return registrarVentaConItems([{ productoId, cantidad }]);
}
