/** Modelo de presentación del Inventario. Es el contrato que necesita la vista. */
export interface InventoryProduct {
  id?: number;
  sku: string;
  nombre: string;
  descripcion?: string;
  categoria: string;
  categoriaId?: number;
  proveedorId?: number;
  unidadMedida?: string;
  stock: number;
  stockFisico?: number;
  stockMinimo: number;
  precioCosto: number | null;
  precioVenta: number;
}
