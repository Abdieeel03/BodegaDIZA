import { useMemo, useState } from 'react';
import type { InventoryProduct } from '../../types/inventory';
import { getStockStatus, selectInventoryProducts, type InventorySort, type StockFilter } from './inventorySelectors';
export type { InventoryProduct } from '../../types/inventory';

/** Estado local de presentación; no escribe al backend. */
export function useInventoryViewState<T extends InventoryProduct>(initialProducts: T[], externalProducts?: T[]) {
  const [localProductos, setProductos] = useState<T[]>(initialProducts);
  const productos = externalProducts ?? localProductos;
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('Todos');
  const [estado, setEstado] = useState<StockFilter>('todos');
  const [orden, setOrden] = useState<InventorySort>('nombre');
  const [porPagina, setPorPagina] = useState(6);
  const [pagina, setPagina] = useState(1);

  const categorias = useMemo(() => {
    const nombres = [...new Set(productos.map(producto => producto.categoria))].sort((a, b) => a.localeCompare(b, 'es-PE'));
    return ['Todos', ...nombres];
  }, [productos]);

  const filtrados = useMemo(
    () => selectInventoryProducts(productos, { busqueda, categoria, estado, orden }),
    [productos, busqueda, categoria, estado, orden],
  );
  const resumenStock = useMemo(() => ({
    disponible: productos.filter(p => getStockStatus(p) === 'disponible').length,
    bajo: productos.filter(p => getStockStatus(p) === 'bajo').length,
    agotado: productos.filter(p => getStockStatus(p) === 'agotado').length,
  }), [productos]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * porPagina;
  const mostrados = filtrados.slice(inicio, inicio + porPagina);

  const valorInventario = useMemo(
    () => productos.some(producto => producto.precioCosto === null)
      ? null
      : productos.reduce((total, producto) => total + producto.stock * (producto.precioCosto ?? 0), 0),
    [productos],
  );

  const cambiarCategoria = (valor: string) => { setCategoria(valor); setPagina(1); };
  const cambiarBusqueda = (valor: string) => { setBusqueda(valor); setPagina(1); };
  const cambiarEstado = (valor: StockFilter) => { setEstado(valor); setPagina(1); };
  const cambiarOrden = (valor: InventorySort) => { setOrden(valor); setPagina(1); };
  const cambiarPorPagina = (valor: number) => {
    if (![6, 12, 24].includes(valor)) return;
    setPorPagina(valor); setPagina(1);
  };
  const limpiarFiltros = () => {
    setBusqueda(''); setCategoria('Todos'); setEstado('todos'); setOrden('nombre'); setPagina(1);
  };

  return {
    productos, setProductos, busqueda, categoria, estado, orden, porPagina,
    setCategoria, setBusqueda, setPagina, categorias, filtrados,
    paginaActual, totalPaginas, inicio, mostrados, resumenStock,
    valorInventario, cambiarCategoria, cambiarBusqueda, cambiarEstado,
    cambiarOrden, cambiarPorPagina, limpiarFiltros,
  };
}
