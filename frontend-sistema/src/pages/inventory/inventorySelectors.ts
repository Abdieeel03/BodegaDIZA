import type { InventoryProduct } from '../../types/inventory';

export type StockStatus = 'disponible' | 'bajo' | 'agotado';
export type StockFilter = 'todos' | StockStatus;
export type InventorySort = 'nombre' | 'stock_asc' | 'stock_desc' | 'prioridad';

/** Clasificación común para resumen, filtros, tabla y tarjetas. */
export function getStockStatus(producto: InventoryProduct): StockStatus {
  if (producto.stock <= 0) return 'agotado';
  if (producto.stock <= producto.stockMinimo) return 'bajo';
  return 'disponible';
}

const prioridad: Record<StockStatus, number> = { agotado: 0, bajo: 1, disponible: 2 };

/** No altera el catálogo: el orden y los filtros son solo una vista local. */
export function selectInventoryProducts<T extends InventoryProduct>(
  productos: T[],
  { busqueda, categoria, estado, orden }: {
    busqueda: string; categoria: string; estado: StockFilter; orden: InventorySort;
  },
): T[] {
  const texto = busqueda.toLocaleLowerCase('es-PE').trim();
  return productos.filter(producto =>
    (categoria === 'Todos' || producto.categoria === categoria)
    && (estado === 'todos' || getStockStatus(producto) === estado)
    && (producto.nombre.toLocaleLowerCase('es-PE').includes(texto)
      || producto.sku.toLocaleLowerCase('es-PE').includes(texto)),
  ).sort((a, b) => {
    if (orden === 'stock_asc') return a.stock - b.stock || a.nombre.localeCompare(b.nombre, 'es-PE');
    if (orden === 'stock_desc') return b.stock - a.stock || a.nombre.localeCompare(b.nombre, 'es-PE');
    if (orden === 'prioridad') {
      return prioridad[getStockStatus(a)] - prioridad[getStockStatus(b)]
        || a.nombre.localeCompare(b.nombre, 'es-PE');
    }
    return a.nombre.localeCompare(b.nombre, 'es-PE');
  });
}
