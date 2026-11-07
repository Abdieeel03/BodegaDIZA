import { useState } from 'react';
import type { InventoryProduct as Producto } from '../../types/inventory';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { listInventoryProducts } from '../../services/inventoryService';
import { useInventoryViewState } from './useInventoryViewState';
import { InventoryDataState, type InventoryDataStatus } from './InventoryDataState';
import type { FormEvent } from 'react';
import './inventory.css';
import './inventory-state.css';
import './inventory-data-state.css';

type EstadoStock = 'disponible' | 'bajo' | 'agotado';

// SOLAMENTE DATOS DE DEMOSTRACIÓN. No representan el inventario real de BodegaDIZA.
// Reemplazaremos este arreglo por la consulta al backend cuando exista el endpoint.
const PRODUCTOS_DE_EJEMPLO: Producto[] = [
  {
    sku: 'SKU-7821', nombre: 'Arroz Costeño Extra 1kg', categoria: 'Abarrotes',
    stock: 48, stockMinimo: 12, precioCosto: 3.8, precioVenta: 4.7,
  },
  {
    sku: 'SKU-7822', nombre: 'Aceite Primor Premium 1L', categoria: 'Abarrotes',
    stock: 22, stockMinimo: 10, precioCosto: 8.4, precioVenta: 10.5,
  },
  {
    sku: 'SKU-7823', nombre: 'Leche Gloria Azul 400g', categoria: 'Lácteos',
    stock: 6, stockMinimo: 10, precioCosto: 3.4, precioVenta: 4.2,
  },
  {
    sku: 'SKU-7824', nombre: 'Fideos Don Vittorio Spaguetti 500g', categoria: 'Pastas',
    stock: 35, stockMinimo: 15, precioCosto: 2.2, precioVenta: 3.1,
  },
  {
    sku: 'SKU-7825', nombre: 'Detergente Bolívar Blanco 900g', categoria: 'Limpieza',
    stock: 0, stockMinimo: 8, precioCosto: 7.1, precioVenta: 9.0,
  },
  {
    sku: 'SKU-7826', nombre: 'Azúcar Rubia Cartavio 1kg', categoria: 'Abarrotes',
    stock: 55, stockMinimo: 20, precioCosto: 3.2, precioVenta: 4.0,
  },
];

// El modo API solo se activa al configurarlo expresamente en frontend-sistema/.env.local.
const MODO_API = import.meta.env.VITE_INVENTORY_MODE === 'api';
const POR_PAGINA = 6;

const moneda = (valor: number) =>
  `S/ ${valor.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const estadoProducto = (producto: Producto): EstadoStock => {
  if (producto.stock === 0) return 'agotado';
  if (producto.stock <= producto.stockMinimo) return 'bajo';
  return 'disponible';
};

const estadoTexto: Record<EstadoStock, string> = {
  disponible: 'En Stock',
  bajo: 'Stock Bajo',
  agotado: 'Agotado',
};

const Lupa = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="10.8" cy="10.8" r="6.4" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

const IconoCaja = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
    <rect x="5" y="8" width="14" height="13" rx="2" />
    <path d="M8 8V5a4 4 0 0 1 8 0v3" />
  </svg>
);

const IconoDinero = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="8" />
    <path d="M14.7 8.8c-.7-.8-4.7-1.5-5 .8-.4 2.5 5.2 1.3 5.1 4.2-.1 2.2-4 2.6-5.6 1.4M12 6v12" />
  </svg>
);

const EtiquetaEstado = ({ producto }: { producto: Producto }) => {
  const estado = estadoProducto(producto);
  return (
    <span className={`inventory-status inventory-status--${estado}`}>
      <span className="inventory-status-dot" aria-hidden="true" />
      {estadoTexto[estado]}
    </span>
  );
};

export const InventoryPage = () => {
  const {
    data: productosApi, status: estadoApi, error: errorApi, reload: recargarApi,
  } = useRemoteResource(listInventoryProducts, MODO_API);

  const {
    productos, setProductos, busqueda, categoria,
    categorias, filtrados, paginaActual, totalPaginas,
    inicio, mostrados, valorInventario, setPagina,
    setCategoria, setBusqueda, cambiarCategoria,
    cambiarBusqueda, limpiarFiltros,
  } = useInventoryViewState(
    MODO_API ? [] : PRODUCTOS_DE_EJEMPLO,
    MODO_API ? (productosApi ?? []) : undefined,
  );
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalCarga, setModalCarga] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [mensaje, setMensaje] = useState('');
  // Vista de prueba de estados. Sustituir por el estado real de consulta cuando haya endpoint.
  const [estadoVista, setEstadoVista] = useState<'ready' | InventoryDataStatus>('ready');

  const estadoRemoto: 'ready' | InventoryDataStatus = !MODO_API
    ? 'ready'
    : estadoApi === 'error'
      ? 'error'
      : estadoApi !== 'success'
        ? 'loading'
        : productos.length === 0
          ? 'empty'
          : 'ready';
  // Los controles de prueba tienen prioridad solo en desarrollo.
  const estadoMostrado = import.meta.env.DEV && estadoVista !== 'ready'
    ? estadoVista
    : estadoRemoto;
  const reintentar = () => {
    if (import.meta.env.DEV && estadoVista !== 'ready') setEstadoVista('ready');
    else if (MODO_API) recargarApi();
  };

  const agregarProducto = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    const nuevo: Producto = {
      sku: String(datos.get('sku') ?? '').trim(),
      nombre: String(datos.get('nombre') ?? '').trim(),
      categoria: String(datos.get('categoria') ?? '').trim(),
      stock: Number(datos.get('stock')),
      stockMinimo: Number(datos.get('stockMinimo')),
      precioCosto: Number(datos.get('precioCosto')),
      precioVenta: Number(datos.get('precioVenta')),
    };

    if (!nuevo.sku || !nuevo.nombre || !nuevo.categoria) {
      setErrorFormulario('Completa el SKU, el nombre y la categoría.');
      return;
    }
    if (productos.some((producto) => producto.sku.toLowerCase() === nuevo.sku.toLowerCase())) {
      setErrorFormulario('Ya existe un producto con ese SKU en esta vista de prueba.');
      return;
    }
    if ([nuevo.stock, nuevo.stockMinimo, nuevo.precioCosto, nuevo.precioVenta]
      .some((valor) => !Number.isFinite(valor) || valor < 0)) {
      setErrorFormulario('Las cantidades y precios deben ser números válidos mayores o iguales a cero.');
      return;
    }

    setProductos((actuales) => [nuevo, ...actuales]);
    setModalNuevo(false);
    setErrorFormulario('');
    setCategoria('Todos');
    setBusqueda(nuevo.sku);
    setPagina(1);
    setMensaje('Producto agregado únicamente a esta vista de prueba. No se guardó en PostgreSQL y desaparecerá al recargar la página.');
  };

  return (
    <section className="inventory-view" aria-labelledby="inventory-title">
      <header className="inventory-heading">
        <div>
          <h1 id="inventory-title">Inventario</h1>
          <p>Consulta y gestiona el stock de productos</p>
        </div>
        <div className="inventory-actions">
          <button
            className="inventory-action inventory-action-add"
            type="button"
            onClick={() => {
              if (MODO_API) {
                setMensaje('El registro de productos estará disponible cuando el backend incorpore su endpoint.');
                return;
              }
              setModalNuevo(true); setErrorFormulario('');
            }}
          >
            <span aria-hidden="true">＋</span> Nuevo Producto
          </button>
          <button
            className="inventory-action inventory-action-bulk"
            type="button"
            onClick={() => setModalCarga(true)}
          >
            <span aria-hidden="true">⇧</span> Carga Masiva
          </button>
        </div>
      </header>

      {!MODO_API && (
        <div className="inventory-demo-note" role="note">
          <strong>Vista de demostración.</strong> Los productos y valores son ejemplos, no datos reales de la bodega.
        </div>
      )}
      {mensaje && (
        <div className="inventory-feedback" role="status">
          <span>{mensaje}</span>
          <button type="button" onClick={() => setMensaje('')} aria-label="Cerrar aviso">×</button>
        </div>
      )}

      {import.meta.env.DEV && (
        <details className="inventory-demo-controls">
          <summary>Probar estados de la interfaz (solo desarrollo)</summary>
          <div className="inventory-demo-controls-options" role="group" aria-label="Vista previa de estados">
            {([
              ['ready', 'Normal'],
              ['loading', 'Cargando'],
              ['error', 'Error'],
              ['empty', 'Sin productos'],
            ] as const).map(([status, label]) => (
              <button
                key={status}
                type="button"
                aria-pressed={estadoVista === status}
                onClick={() => setEstadoVista(status)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="inventory-demo-controls-note">Simulación visual local: no consulta ni cambia PostgreSQL.</p>
        </details>
      )}

      {estadoMostrado === 'ready' ? (
        <>
      <div className="inventory-summary">
        <article className="inventory-summary-card">
          <div>
            <span className="inventory-summary-label">TOTAL SKUs</span>
            <strong className="inventory-summary-value">{productos.length.toLocaleString('es-PE')}</strong>
            <span className="inventory-summary-subline"><span className="inventory-summary-live">●</span> Productos en la vista</span>
          </div>
          <span className="inventory-summary-icon inventory-summary-icon--blue"><IconoCaja /></span>
        </article>
        <article className="inventory-summary-card">
          <div>
            <span className="inventory-summary-label">VALORIZADO</span>
            <strong className="inventory-summary-value">{moneda(valorInventario)}</strong>
            <span className="inventory-summary-subline">Suma del stock × costo de ejemplo</span>
          </div>
          <span className="inventory-summary-icon inventory-summary-icon--green"><IconoDinero /></span>
        </article>
      </div>

      <section className="inventory-panel" aria-label="Listado de inventario">
        <div className="inventory-panel-top">
          <div className="inventory-panel-title">
            <h2>Tabla Inventario</h2>
            <span>Mostrando {mostrados.length} productos</span>
          </div>
          <label className="inventory-search">
            <Lupa />
            <input
              type="search"
              placeholder="Buscar por SKU o nombre..."
              value={busqueda}
              onChange={(event) => cambiarBusqueda(event.target.value)}
              aria-label="Buscar por SKU o nombre"
            />
          </label>
        </div>

        <div className="inventory-category-tabs" role="group" aria-label="Filtrar productos por categoría">
          {categorias.map((nombre) => (
            <button
              key={nombre}
              type="button"
              className={`inventory-category-tab${categoria === nombre ? ' is-selected' : ''}`}
              onClick={() => cambiarCategoria(nombre)}
              aria-pressed={categoria === nombre}
            >
              {nombre} <span>{nombre === 'Todos'
                ? productos.length
                : productos.filter((producto) => producto.categoria === nombre).length}</span>
            </button>
          ))}
        </div>

        <div className="inventory-table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>CÓDIGO SKU</th>
                <th>NOMBRE DEL PRODUCTO</th>
                <th>CATEGORÍA</th>
                <th>STOCK ACTUAL</th>
                <th>STOCK MÍNIMO</th>
                <th>PRECIO COSTO</th>
                <th>PRECIO VENTA</th>
                <th>ESTADO DE DISPONIBILIDAD</th>
              </tr>
            </thead>
            <tbody>
              {mostrados.map((producto) => (
                <tr key={producto.sku}>
                  <td className="inventory-sku">{producto.sku}</td>
                  <td className="inventory-name">{producto.nombre}</td>
                  <td className="inventory-category-cell">{producto.categoria}</td>
                  <td className={`inventory-stock inventory-stock--${estadoProducto(producto)}`}>{producto.stock}</td>
                  <td>{producto.stockMinimo}</td>
                  <td>{moneda(producto.precioCosto)}</td>
                  <td className="inventory-sale-price">{moneda(producto.precioVenta)}</td>
                  <td><EtiquetaEstado producto={producto} /></td>
                </tr>
              ))}
              {mostrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="inventory-empty">
                    <strong>{productos.length === 0 ? 'Aún no hay productos' : 'Sin resultados'}</strong>
                    <p>{productos.length === 0
                      ? 'No se han registrado productos en esta vista.'
                      : 'No hay productos que coincidan con la búsqueda y la categoría.'}</p>
                    {productos.length > 0 && (
                      <button type="button" className="inventory-clear-filters" onClick={limpiarFiltros}>
                        Limpiar filtros
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inventory-mobile-products">
          {mostrados.map((producto) => (
            <article className="inventory-product-card" key={producto.sku}>
              <div className="inventory-product-meta">
                <span><strong>{producto.sku}</strong> · {producto.categoria}</span>
                <EtiquetaEstado producto={producto} />
              </div>
              <h3>{producto.nombre}</h3>
              <div className="inventory-product-details">
                <div>
                  <span>STOCK ACTUAL</span>
                  <strong className={`inventory-stock--${estadoProducto(producto)}`}>
                    {producto.stock} <small>/ mín {producto.stockMinimo}</small>
                  </strong>
                </div>
                <div>
                  <span>COSTO COMPRA</span>
                  <strong>{moneda(producto.precioCosto)}</strong>
                </div>
                <div>
                  <span>PRECIO VENTA</span>
                  <strong className="inventory-sale-price">{moneda(producto.precioVenta)}</strong>
                </div>
              </div>
            </article>
          ))}
          {mostrados.length === 0 && (
            <div className="inventory-empty" role="status">
              <strong>{productos.length === 0 ? 'Aún no hay productos' : 'Sin resultados'}</strong>
              <p>{productos.length === 0
                ? 'No se han registrado productos en esta vista.'
                : 'Prueba con otro nombre, SKU o categoría.'}</p>
              {productos.length > 0 && (
                <button type="button" className="inventory-clear-filters" onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        <div className="inventory-footer">
          <span>
            {filtrados.length === 0
              ? 'Mostrando 0 productos'
              : `Mostrando ${inicio + 1} a ${Math.min(inicio + POR_PAGINA, filtrados.length)} de ${filtrados.length} productos`}
          </span>
          <div className="inventory-pagination" aria-label="Paginación del inventario">
            <button
              type="button"
              disabled={paginaActual === 1}
              onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
              className="inventory-page-previous"
            >
              <span className="inventory-pagination-text">Anterior</span><span className="inventory-pagination-icon">‹</span>
            </button>
            {Array.from({ length: totalPaginas }, (_, numero) => numero + 1)
              .filter((numero) => numero === 1 || numero === totalPaginas || Math.abs(numero - paginaActual) <= 1)
              .map((numero) => (
                <button
                  type="button"
                  key={numero}
                  className={`inventory-page-number${paginaActual === numero ? ' is-current' : ''}`}
                  aria-current={paginaActual === numero ? 'page' : undefined}
                  onClick={() => setPagina(numero)}
                >
                  {numero}
                </button>
              ))}
            <button
              type="button"
              disabled={paginaActual === totalPaginas}
              onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
              className="inventory-page-next"
            >
              <span className="inventory-pagination-text">Siguiente</span><span className="inventory-pagination-icon">›</span>
            </button>
          </div>
        </div>
      </section>

        </>
      ) : (
        <InventoryDataState
          status={estadoMostrado}
          onRetry={reintentar}
          errorMessage={MODO_API && estadoMostrado === 'error' && estadoVista === 'ready' ? errorApi : null}
        />
      )}

      {modalNuevo && (
        <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setModalNuevo(false);
        }}>
          <div className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title">
            <div className="inventory-modal-header">
              <div>
                <h2 id="inventory-modal-title">Nuevo producto</h2>
                <p>Registro de prueba, sin conexión al backend.</p>
              </div>
              <button type="button" onClick={() => setModalNuevo(false)} aria-label="Cerrar formulario">×</button>
            </div>
            <form onSubmit={agregarProducto} className="inventory-product-form">
              <label>SKU<input name="sku" maxLength={40} required placeholder="Ej. SKU-9001" /></label>
              <label>Nombre del producto<input name="nombre" maxLength={120} required placeholder="Nombre real del producto" /></label>
              <label>Categoría<input name="categoria" maxLength={40} required placeholder="Ej. Abarrotes" /></label>
              <div className="inventory-form-grid">
                <label>Stock actual<input name="stock" type="number" min="0" step="1" defaultValue="0" required /></label>
                <label>Stock mínimo<input name="stockMinimo" type="number" min="0" step="1" defaultValue="5" required /></label>
                <label>Precio costo (S/)<input name="precioCosto" type="number" min="0" step="0.01" defaultValue="0" required /></label>
                <label>Precio venta (S/)<input name="precioVenta" type="number" min="0" step="0.01" defaultValue="0" required /></label>
              </div>
              {errorFormulario && <p className="inventory-form-error" role="alert">{errorFormulario}</p>}
              <p className="inventory-form-disclaimer">Los cambios son temporales y se perderán al actualizar la página.</p>
              <div className="inventory-modal-actions">
                <button type="button" className="inventory-action inventory-action-bulk" onClick={() => setModalNuevo(false)}>Cancelar</button>
                <button type="submit" className="inventory-action inventory-action-add">Agregar a la vista</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalCarga && (
        <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setModalCarga(false);
        }}>
          <div className="inventory-modal inventory-modal--small" role="dialog" aria-modal="true" aria-labelledby="inventory-bulk-title">
            <div className="inventory-modal-header">
              <div><h2 id="inventory-bulk-title">Carga masiva</h2><p>Integración pendiente</p></div>
              <button type="button" onClick={() => setModalCarga(false)} aria-label="Cerrar aviso">×</button>
            </div>
            <p className="inventory-bulk-explanation">El diseño del botón ya está preparado. La carga de archivos Excel/CSV se conectará cuando exista un servicio de inventario en el backend. Por ahora no importamos ni modificamos productos reales.</p>
            <button type="button" className="inventory-action inventory-action-add" onClick={() => setModalCarga(false)}>Entendido</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default InventoryPage;
