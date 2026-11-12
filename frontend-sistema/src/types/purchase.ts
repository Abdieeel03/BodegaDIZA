import type { Id, IsoDateTime } from './common';

export type EstadoCompra = 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA';

export interface Compra {
  id: Id;
  proveedorId: Id;
  fecha: IsoDateTime;
  estado: EstadoCompra;
  total: number;
}

export interface DetalleCompra {
  id: Id;
  compraId: Id;
  productoId: Id;
  loteId: Id;
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}
