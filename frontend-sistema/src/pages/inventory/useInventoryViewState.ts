import { useMemo, useState } from 'react';

// Estado exclusivamente local y temporal. No realiza llamadas a la API.
// Cuando se implemente Inventario en el backend, la lista de productos
// podrá venir de un servicio sin reescribir el buscador ni la paginación.
import type { InventoryProduct } from '../../types/inventory';
export type { InventoryProduct } from '../../types/inventory';

const ITEMS_PER_PAGE = 6;

export function useInventoryViewState<T extends InventoryProduct>(initialProducts: T[], externalProducts?: T[]) {
  const [localProductos, setProductos] = useState<T[]>(initialProducts);
  // Los datos remotos se calculan desde la respuesta, sin copiarlos al estado local.
  const productos = externalProducts ?? localProductos;
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('Todos');
  const [pagina, setPagina] = useState(1);

  // Las categorías se actualizan si se añade un producto en el formulario.
  const categorias = useMemo(() => {
    const nombres = [...new Set(productos.map((producto) => producto.categoria))];
    return ['Todos', ...nombres];
  }, [productos]);

  // Búsqueda y categoría combinables: ambas se aplican a la misma lista.
  const filtrados = useMemo(() => {
    const texto = busqueda.toLocaleLowerCase('es-PE').trim();
    return productos.filter((producto) => {
      const coincideCategoria = categoria === 'Todos' || producto.categoria === categoria;
      const coincideTexto =
        producto.nombre.toLocaleLowerCase('es-PE').includes(texto) ||
        producto.sku.toLocaleLowerCase('es-PE').includes(texto);
      return coincideCategoria && coincideTexto;
    });
  }, [productos, busqueda, categoria]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITEMS_PER_PAGE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * ITEMS_PER_PAGE;
  const mostrados = filtrados.slice(inicio, inicio + ITEMS_PER_PAGE);

  const valorInventario = useMemo(
    () => productos.some((producto) => producto.precioCosto === null)
      ? null
      : productos.reduce((total, producto) => total + producto.stock * (producto.precioCosto ?? 0), 0),
    [productos],
  );

  const cambiarCategoria = (nuevaCategoria: string) => {
    setCategoria(nuevaCategoria);
    setPagina(1);
  };

  const cambiarBusqueda = (valor: string) => {
    setBusqueda(valor);
    setPagina(1);
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setCategoria('Todos');
    setPagina(1);
  };

  return {
    productos, setProductos,
    busqueda, setBusqueda, categoria, setCategoria,
    pagina, setPagina, categorias, filtrados,
    paginaActual, totalPaginas, inicio, mostrados,
    valorInventario, cambiarCategoria, cambiarBusqueda, limpiarFiltros,
  };
}
