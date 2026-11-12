import type { Id, IsoDate, IsoDateTime } from './common';

export type TipoMovimientoInventario = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export interface LoteProducto {
  id: Id;
  productoId: Id;
  codigoLote: string;
  cantidadDisponible: number;
  fechaIngreso: IsoDate;
  fechaVencimiento: IsoDate;
}

export interface MovimientoInventario {
  id: Id;
  productoId: Id;
  loteId: Id | null;
  tipo: TipoMovimientoInventario;
  cantidad: number;
  fecha: IsoDateTime;
  motivo: string | null;
  usuarioId: Id;
  compraId: Id | null;
  ventaId: Id | null;
}
