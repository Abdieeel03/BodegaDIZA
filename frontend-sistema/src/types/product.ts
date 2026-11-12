import type { Id } from './common';

export type UnidadMedida = 'BOTELLA' | 'CAJA' | 'PACK' | 'LITRO';

export interface Producto {
  id: Id;
  sku: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: Id;
  proveedorId: Id;
  precioVenta: number;
  stockMinimo: number;
  unidadMedida: UnidadMedida;
  activo: boolean;
}

export interface ProductoInventario extends Producto {
  stockDisponible: number;
}
