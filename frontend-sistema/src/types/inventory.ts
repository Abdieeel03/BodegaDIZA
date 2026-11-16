/** Modelo de presentación del Inventario. Es el contrato que necesita la vista. */
export interface InventoryProduct {
  sku: string;
  nombre: string;
  categoria: string;
  stock: number;
  stockMinimo: number;
  precioCosto: number | null;
  precioVenta: number;
}
