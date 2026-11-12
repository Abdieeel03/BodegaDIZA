import type { Id, IsoDateTime } from './common';

export interface Venta {
  id: Id;
  fecha: IsoDateTime;
  total: number;
  usuarioId: Id;
}

export interface DetalleVenta {
  id: Id;
  ventaId: Id;
  productoId: Id;
  loteId: Id;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}
