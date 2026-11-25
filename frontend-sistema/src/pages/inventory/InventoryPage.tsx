import { Link, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import type { InventoryProduct as Producto } from '../../types/inventory';
import apiClient from '../../api/axios';
import type { ApiResponse } from '../../types';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { listInventoryProducts, updateInventoryProduct } from '../../services/inventoryService';
import { useInventoryViewState } from './useInventoryViewState';
import { getStockStatus, type StockFilter, type InventorySort } from './inventorySelectors';
import { InventoryDataState, type InventoryDataStatus } from './InventoryDataState';
import { PageHeader, StatusBadge, TableFrame } from '../../components/ui';
import './inventory.css';
import './inventory-state.css';
import './inventory-data-state.css';


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

const moneda = (valor: number) =>
  `S/ ${valor.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const estadoTexto: Record<ReturnType<typeof getStockStatus>, string> = {
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
  const estado = getStockStatus(producto);
  return (
    <StatusBadge tone={estado === 'disponible' ? 'success' : estado === 'bajo' ? 'warning' : 'danger'}>
      {estadoTexto[estado]}
    </StatusBadge>
  );
};

export const InventoryPage = () => {
  const navigate = useNavigate();
  const {
    data: productosApi, status: estadoApi, error: errorApi, reload: recargarApi,
  } = useRemoteResource(listInventoryProducts, MODO_API);

  const {
    productos, setProductos, busqueda, categoria, estado, orden, porPagina,
    categorias, filtrados, paginaActual, totalPaginas, resumenStock,
    inicio, mostrados, valorInventario, setPagina,
    cambiarCategoria, cambiarEstado, cambiarOrden,
    cambiarPorPagina, cambiarBusqueda, limpiarFiltros,
  } = useInventoryViewState(
    MODO_API ? [] : PRODUCTOS_DE_EJEMPLO,
    MODO_API ? (productosApi ?? []) : undefined,
  );
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalCarga, setModalCarga] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [editing, setEditing] = useState<Producto | null>(null);
  const [editCategories, setEditCategories] = useState<{ id: number; nombre: string; activa: boolean }[]>([]);
  const [editSuppliers, setEditSuppliers] = useState<{ id: number; nombre: string; activo: boolean }[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const openEdit = async (producto: Producto) => {
    setEditError('');
    setEditing(producto);
    if (!editCategories.length || !editSuppliers.length) {
      try {
        const [catRes, supRes] = await Promise.all([
          apiClient.get<ApiResponse<{ id: number; nombre: string; activa: boolean }[]>>('/categorias'),
          apiClient.get<ApiResponse<{ id: number; nombre: string; activo: boolean }[]>>('/proveedores'),
        ]);
        if (catRes.data.success && catRes.data.data) setEditCategories(catRes.data.data.filter(c => c.activa));
        if (supRes.data.success && supRes.data.data) setEditSuppliers(supRes.data.data.filter(s => s.activo));
      } catch {
        setEditError('No se pudieron cargar categorías y proveedores.');
      }
    }
  };

  const guardarEdicion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing?.id || editSaving) return;
    const datos = new FormData(event.currentTarget);
    const nombre = String(datos.get('nombre') ?? '').trim();
    const descripcion = String(datos.get('descripcion') ?? '').trim();
    const categoriaId = Number(datos.get('categoriaId'));
    const proveedorId = Number(datos.get('proveedorId'));
    const precioVenta = Number(datos.get('precioVenta'));
    const stockMinimo = Number(datos.get('stockMinimo'));
    const unidadMedida = String(datos.get('unidadMedida') ?? editing.unidadMedida ?? 'UNIDAD');

    if (!nombre || !categoriaId || !proveedorId) {
      setEditError('Completa el nombre, la categoría y el proveedor.');
      return;
    }
    if (!Number.isFinite(precioVenta) || precioVenta < 0 || !Number.isFinite(stockMinimo) || stockMinimo < 0) {
      setEditError('Precio y stock mínimo deben ser válidos.');
      return;
    }

    setEditSaving(true);
    setEditError('');
    try {
      await updateInventoryProduct(editing.id, {
        sku: editing.sku,
        nombre,
        descripcion,
        categoriaId,
        proveedorId,
        precioVenta,
        stockMinimo,
        unidadMedida,
      });
      setEditing(null);
      setMensaje(`Producto ${editing.sku} (${nombre}) actualizado correctamente.`);
      recargarApi();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'No se pudo actualizar el producto.');
    } finally {
      setEditSaving(false);
    }
  };

  const estadoMostrado: 'ready' | InventoryDataStatus = !MODO_API
    ? 'ready'
    : estadoApi === 'error'
      ? 'error'
      : estadoApi !== 'success'
        ? 'loading'
        : productos.length === 0
          ? 'empty'
          : 'ready';
  const reintentar = () => {
    if (MODO_API) recargarApi();
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
      .some((valor) => typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0)) {
      setErrorFormulario('Las cantidades y precios deben ser números válidos mayores o iguales a cero.');
      return;
    }

    setProductos((actuales) => [nuevo, ...actuales]);
    setModalNuevo(false);
    setErrorFormulario('');
    limpiarFiltros();
    cambiarBusqueda(nuevo.sku);
    setMensaje('Producto agregado únicamente a esta vista de prueba. No se guardó en PostgreSQL y desaparecerá al recargar la página.');
  };

  return (
    <section className="inventory-view" aria-labelledby="inventory-title">
      <PageHeader
        titleId="inventory-title"
        title="Inventario"
        description="Consulta productos y existencias."
        actions={
        <div className="inventory-actions">
          {MODO_API ? (
  <>
    <Link className="inventory-action inventory-action-add" to="/inventario/agregar">
      <span aria-hidden="true">＋</span> Nuevo producto
    </Link>
    <Link className="inventory-action inventory-action-bulk" to="/inventario/agregar?modo=restock">
      Reponer stock
    </Link>
  </>
) : (
<button
            className="inventory-action inventory-action-add"
            type="button"
            onClick={() => {
              if (MODO_API) {
                setMensaje('El backend dispone de POST /productos; falta integrar y validar el formulario antes de habilitar el registro real.');
                return;
              }
              setModalNuevo(true); setErrorFormulario('');
            }}
          >
            <span aria-hidden="true">＋</span> Nuevo producto
          </button>
)}
<Link className="inventory-action inventory-action-bulk" to="/inventario/movimientos">
  Historial de movimientos
</Link>
          <button
            className="inventory-action inventory-action-bulk"
            type="button"
            onClick={() => navigate('/inventario/carga-masiva')}
          >
            <span aria-hidden="true">⇧</span> Importar productos
          </button>
        </div>
        }
      />

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



      {estadoMostrado === 'ready' ? (
        <>
      <div className="inventory-summary">
        <article className="inventory-summary-card">
          <div>
            <span className="inventory-summary-label">TOTAL SKUs</span>
            <strong className="inventory-summary-value">{productos.length.toLocaleString('es-PE')}</strong>
            <span className="inventory-summary-subline">Productos registrados</span>
          </div>
          <span className="inventory-summary-icon inventory-summary-icon--blue"><IconoCaja /></span>
        </article>
        <article className="inventory-summary-card">
          <div>
            <span className="inventory-summary-label">VALORIZADO</span>
            <strong className="inventory-summary-value">{valorInventario === null ? 'No disponible' : moneda(valorInventario)}</strong>
            <span className="inventory-summary-subline">{MODO_API ? 'El catálogo no devuelve costo de compra' : 'Suma del stock × costo de ejemplo'}</span>
          </div>
          <span className="inventory-summary-icon inventory-summary-icon--green"><IconoDinero /></span>
        </article>
        <article className="inventory-summary-card inventory-summary-card--attention">
          <div>
            <span className="inventory-summary-label">REQUIEREN ATENCIÓN</span>
            <strong className="inventory-summary-value">{resumenStock.bajo + resumenStock.agotado}</strong>
            <span className="inventory-summary-subline">{resumenStock.bajo} con stock bajo · {resumenStock.agotado} agotados</span>
          </div>
          <span className="inventory-summary-icon inventory-summary-icon--warning" aria-hidden="true">!</span>
        </article>
      </div>

      <section className="inventory-panel" aria-label="Listado de inventario">
        <div className="inventory-panel-top">
          <div className="inventory-panel-title">
            <h2>Productos en inventario</h2>
            <span>{filtrados.length} coincidencias</span>
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

        <div className="inventory-filter-bar" aria-label="Filtros de inventario">
          <label className="inventory-filter-field" htmlFor="inv-filter-category">
            <span>Categoría</span>
            <select id="inv-filter-category" value={categoria}
              onChange={event => cambiarCategoria(event.target.value)}>
              {categorias.map(nombre => (
                <option key={nombre} value={nombre}>{nombre}</option>
              ))}
            </select>
          </label>
          <label className="inventory-filter-field" htmlFor="inv-filter-status">
            <span>Estado de stock</span>
            <select id="inv-filter-status" value={estado}
              onChange={event => cambiarEstado(event.target.value as StockFilter)}>
              <option value="todos">Todos los estados</option>
              <option value="disponible">En stock ({resumenStock.disponible})</option>
              <option value="bajo">Stock bajo ({resumenStock.bajo})</option>
              <option value="agotado">Agotados ({resumenStock.agotado})</option>
            </select>
          </label>
          <label className="inventory-filter-field" htmlFor="inv-filter-sort">
            <span>Ordenar por</span>
            <select id="inv-filter-sort" value={orden}
              onChange={event => cambiarOrden(event.target.value as InventorySort)}>
              <option value="nombre">Nombre (A–Z)</option>
              <option value="prioridad">Mayor prioridad</option>
              <option value="stock_asc">Menor stock</option>
              <option value="stock_desc">Mayor stock</option>
            </select>
          </label>
          <label className="inventory-filter-field inventory-filter-field--size" htmlFor="inv-filter-size">
            <span>Por página</span>
            <select id="inv-filter-size" value={porPagina}
              onChange={event => cambiarPorPagina(Number(event.target.value))}>
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
            </select>
          </label>
          {(busqueda.trim() || categoria !== 'Todos' || estado !== 'todos' || orden !== 'nombre') && (
            <button className="inventory-filter-reset" type="button" onClick={limpiarFiltros}>
              Restablecer filtros
            </button>
          )}
        </div>
        <p className="inventory-filter-count" role="status" aria-live="polite">
          {filtrados.length} {filtrados.length === 1 ? 'producto coincide' : 'productos coinciden'} con los filtros.
        </p>

        <TableFrame label="Tabla de productos del inventario" className="inventory-table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>CÓDIGO SKU</th>
                <th>NOMBRE DEL PRODUCTO</th>
                <th>CATEGORÍA</th>
                <th>STOCK VENDIBLE / FÍSICO</th>
                <th>STOCK MÍNIMO</th>
                <th>PRECIO COSTO</th>
                <th>PRECIO VENTA</th>
                <th>ESTADO DE DISPONIBILIDAD</th>
                {MODO_API && <th>ACCIONES</th>}
              </tr>
            </thead>
            <tbody>
              {mostrados.map((producto) => (
                <tr key={producto.sku}>
                  <td className="inventory-sku">{producto.sku}</td>
                  <td className="inventory-name">{producto.nombre}</td>
                  <td className="inventory-category-cell">{producto.categoria}</td>
                  <td><span className={`inventory-stock inventory-stock--${getStockStatus(producto)}`}>{producto.stock}</span>{MODO_API && <small style={{ display: 'block' }}>Físico: {producto.stockFisico}</small>}</td>
                  <td>{producto.stockMinimo}</td>
                  <td>{producto.precioCosto === null ? '—' : moneda(producto.precioCosto)}</td>
                  <td className="inventory-sale-price">{moneda(producto.precioVenta)}</td>
                  <td><EtiquetaEstado producto={producto} /></td>
                  {MODO_API && (
                    <td className="inventory-row-actions">
                      <Link className="inventory-row-btn" to={`/proximos-a-vencer?sku=${encodeURIComponent(producto.sku)}`}>Lotes</Link>
                      <Link className="inventory-row-btn" to={`/inventario/agregar?modo=restock&${producto.id ? `productoId=${producto.id}` : `sku=${encodeURIComponent(producto.sku)}`}`}>
                        Reponer
                      </Link>
                      {producto.id && (
                        <button type="button" className="inventory-row-btn" onClick={() => { void openEdit(producto); }}>
                          Editar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {mostrados.length === 0 && (
                <tr>
                  <td colSpan={MODO_API ? 9 : 8} className="inventory-empty">
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
        </TableFrame>

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
                  <strong className={`inventory-stock--${getStockStatus(producto)}`}>
                    {producto.stock} <small>vendibles / mín {producto.stockMinimo} · Físico: {producto.stockFisico ?? producto.stock}</small>
                  </strong>
                </div>
                <div>
                  <span>COSTO COMPRA</span>
                  <strong>{producto.precioCosto === null ? '—' : moneda(producto.precioCosto)}</strong>
                </div>
                <div>
                  <span>PRECIO VENTA</span>
                  <strong className="inventory-sale-price">{moneda(producto.precioVenta)}</strong>
                </div>
              </div>
              {MODO_API && (
                <div className="inventory-row-actions inventory-row-actions--mobile">
                  <Link className="inventory-row-btn" to={`/inventario/agregar?modo=restock&${producto.id ? `productoId=${producto.id}` : `sku=${encodeURIComponent(producto.sku)}`}`}>
                    Reponer stock
                  </Link>
                  {producto.id && (
                    <button type="button" className="inventory-row-btn" onClick={() => { void openEdit(producto); }}>
                      Editar producto
                    </button>
                  )}
                </div>
              )}
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
              : `Mostrando ${inicio + 1} a ${Math.min(inicio + porPagina, filtrados.length)} de ${filtrados.length} productos`}
          </span>
          <div className="inventory-pagination" aria-label="Paginación del inventario">
            <button
              type="button"
              disabled={paginaActual === 1}
              onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
              className="inventory-page-previous"
              aria-label="Página anterior"
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
                  aria-label={`Ir a la página ${numero}`}
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
              aria-label="Página siguiente"
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
          errorMessage={MODO_API && estadoMostrado === 'error' ? errorApi : null}
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

      {editing && (
        <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !editSaving) setEditing(null);
        }}>
          <div className="inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-edit-title">
            <div className="inventory-modal-header">
              <div>
                <h2 id="inventory-edit-title">Editar producto</h2>
                <p>SKU: {editing.sku}</p>
              </div>
              <button type="button" disabled={editSaving} onClick={() => setEditing(null)} aria-label="Cerrar editor">×</button>
            </div>
            <form key={`${editing.id}-${editCategories.length}-${editSuppliers.length}`} onSubmit={(event) => { void guardarEdicion(event); }} className="inventory-product-form">
              <label>Nombre del producto
                <input name="nombre" maxLength={150} required defaultValue={editing.nombre} />
              </label>
              <div className="inventory-form-grid">
                <label>Categoría
                  <select name="categoriaId" required defaultValue={editing.categoriaId ?? ''}>
                    {!editing.categoriaId && <option value="">Selecciona categoría</option>}
                    {editCategories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </label>
                <label>Proveedor
                  <select name="proveedorId" required defaultValue={editing.proveedorId ?? ''}>
                    {!editing.proveedorId && <option value="">Selecciona proveedor</option>}
                    {editSuppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </label>
                <label>Precio venta (S/)
                  <input name="precioVenta" type="number" min="0" step="0.01" required defaultValue={editing.precioVenta} />
                </label>
                <label>Stock mínimo
                  <input name="stockMinimo" type="number" min="0" step="0.001" required defaultValue={editing.stockMinimo} />
                </label>
                <label>Unidad de medida
                  <select name="unidadMedida" defaultValue={editing.unidadMedida ?? 'UNIDAD'}>
                    {['UNIDAD', 'BOTELLA', 'CAJA', 'PACK', 'LITRO', 'BOLSA', 'LATA', 'KILOGRAMO'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>Descripción
                <input name="descripcion" maxLength={500} defaultValue={editing.descripcion ?? ''} />
              </label>
              {editError && <p className="inventory-form-error" role="alert">{editError}</p>}
              <div className="inventory-modal-actions">
                <button type="button" className="inventory-action inventory-action-bulk" disabled={editSaving} onClick={() => setEditing(null)}>Cancelar</button>
                <button type="submit" className="inventory-action inventory-action-add" disabled={editSaving}>
                  {editSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default InventoryPage;
