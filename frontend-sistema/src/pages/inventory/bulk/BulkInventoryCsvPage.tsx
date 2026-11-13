import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../../api/axios';
import type { ApiResponse } from '../../../types';
import './bulk-inventory-csv.css';

/** Carga de catálogo y proveedores DEMO. NO carga stock histórico como stock operativo. */
type Unit = 'UNIDAD' | 'BOTELLA' | 'CAJA' | 'PACK' | 'LITRO' | 'BOLSA' | 'LATA' | 'KILOGRAMO';
type CsvProduct = {
  sku: string;
  nombre: string;
  categoria: string;
  precioVenta: number;
  stockMinimo: number;
  stockHistorico: number;
  proveedorNombre: string;
  proveedorRuc: string;
  unidad: Unit;
};
type Category = { id: number; nombre: string; activa: boolean };
type Supplier = { id: number; nombre: string; ruc: string; activo: boolean };
type ExistingProduct = { id: number; sku: string };
type ItemOutcome = { sku: string; estado: 'creado' | 'omitido' | 'error'; descripcion: string };
const UNITS: Unit[] = ['UNIDAD', 'BOTELLA', 'CAJA', 'PACK', 'LITRO', 'BOLSA', 'LATA', 'KILOGRAMO'];
const clean = (s: string) => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\r' || c === '\n') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('CSV inválido: comillas sin cerrar.');
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

function number(value: string, label: string, line: number): number {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) throw new Error(`Fila ${line}: ${label} debe ser un número positivo o cero con punto decimal.`);
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`Fila ${line}: valor inválido para ${label}.`);
  return result;
}

function parseCsv(text: string): CsvProduct[] {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2 || rows.length > 1001) throw new Error('El archivo debe contener entre 1 y 1000 productos.');
  const header = rows[0].map((x) => x.trim().toLowerCase());
  const required = ['id_producto', 'nombre_producto', 'categoria', 'precio_venta_unitario', 'stock_minimo_seguridad', 'stock_actual', 'nombre_proveedor', 'ruc_proveedor', 'unidad_medida'];
  const missing = required.filter((x) => !header.includes(x));
  if (missing.length) throw new Error(`Faltan columnas: ${missing.join(', ')}. Selecciona productos_con_proveedores_demo.csv.`);
  const idx = (key: string) => header.indexOf(key);
  const skus = new Set<string>();
  const namesByRuc = new Map<string, string>();
  const rucsByName = new Map<string, string>();
  return rows.slice(1).map((cells, i) => {
    const line = i + 2;
    if (cells.length !== header.length) throw new Error(`Fila ${line}: número de columnas incorrecto.`);
    const sku = cells[idx('id_producto')].trim().toUpperCase();
    const nombre = cells[idx('nombre_producto')].trim();
    const categoria = cells[idx('categoria')].trim();
    const proveedorNombre = cells[idx('nombre_proveedor')].trim();
    const proveedorRuc = cells[idx('ruc_proveedor')].trim();
    const unidad = cells[idx('unidad_medida')].trim().toUpperCase() as Unit;
    if (!sku || sku.length > 50 || !nombre || nombre.length > 150 || !categoria || categoria.length > 100) throw new Error(`Fila ${line}: SKU, nombre o categoría inválidos.`);
    if (!proveedorNombre || proveedorNombre.length > 150 || !/^\d{11}$/.test(proveedorRuc)) throw new Error(`Fila ${line}: proveedor o RUC de 11 dígitos inválido.`);
    if (!UNITS.includes(unidad)) throw new Error(`Fila ${line}: unidad_medida debe ser una de ${UNITS.join(', ')}.`);
    if (skus.has(clean(sku))) throw new Error(`Fila ${line}: SKU repetido: ${sku}.`);
    skus.add(clean(sku));
    if (namesByRuc.has(proveedorRuc) && namesByRuc.get(proveedorRuc) !== clean(proveedorNombre)) throw new Error(`Fila ${line}: un mismo RUC tiene diferentes nombres.`);
    if (rucsByName.has(clean(proveedorNombre)) && rucsByName.get(clean(proveedorNombre)) !== proveedorRuc) throw new Error(`Fila ${line}: un mismo proveedor tiene diferentes RUC.`);
    namesByRuc.set(proveedorRuc, clean(proveedorNombre));
    rucsByName.set(clean(proveedorNombre), proveedorRuc);
    return {
      sku, nombre, categoria, proveedorNombre, proveedorRuc, unidad,
      precioVenta: number(cells[idx('precio_venta_unitario')], 'precio_venta_unitario', line),
      stockMinimo: number(cells[idx('stock_minimo_seguridad')], 'stock_minimo_seguridad', line),
      stockHistorico: number(cells[idx('stock_actual')], 'stock_actual', line),
    };
  });
}

function message(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message;
  return 'No fue posible completar la solicitud.';
}
async function getData<T>(path: string): Promise<T> {
  const response = await apiClient.get<ApiResponse<T>>(path);
  if (!response.data.success || response.data.data == null) throw new Error(response.data.message || `No se pudo consultar ${path}`);
  return response.data.data;
}
async function postData<T>(path: string, payload: object): Promise<T> {
  const response = await apiClient.post<ApiResponse<T>>(path, payload);
  if (!response.data.success || response.data.data == null) throw new Error(response.data.message || `No se pudo registrar ${path}`);
  return response.data.data;
}

export const BulkInventoryCsvPage = () => {
  const [rows, setRows] = useState<CsvProduct[]>([]);
  const [fileName, setFileName] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [existing, setExisting] = useState<ExistingProduct[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [outcomes, setOutcomes] = useState<ItemOutcome[]>([]);
  const [supplierCreated, setSupplierCreated] = useState(0);
  const [categoryCreated, setCategoryCreated] = useState(0);
  const [units, setUnits] = useState<Record<string, Unit>>({});

  const checkTestDb = async () => {
    const apiUrl = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
    if (apiUrl !== 'http://localhost:8081') throw new Error('Seguridad TEST: configura VITE_API_BASE_URL=http://localhost:8081.');
    // El backend solo devuelve 200 cuando la base real se llama exactamente bodega_diza_test.
    await getData<unknown>('/test-data/resumen');
  };

  const loadCatalogs = async () => {
    await checkTestDb();
    const [cats, prov, prod] = await Promise.all([
      getData<Category[]>('/categorias'),
      getData<Supplier[]>('/proveedores'),
      getData<ExistingProduct[]>('/productos'),
    ]);
    setCategories(cats); setSuppliers(prov); setExisting(prod); setReady(true);
    return { cats, prov, prod };
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const apiUrl = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
        if (apiUrl !== 'http://localhost:8081') throw new Error('Seguridad TEST: configura VITE_API_BASE_URL=http://localhost:8081.');
        await getData<unknown>('/test-data/resumen');
        const [cats, prov, prod] = await Promise.all([
          getData<Category[]>('/categorias'),
          getData<Supplier[]>('/proveedores'),
          getData<ExistingProduct[]>('/productos'),
        ]);
        if (active) { setCategories(cats); setSuppliers(prov); setExisting(prod); setReady(true); }
      } catch (e) { if (active) setError(message(e)); }
    })();
    return () => { active = false; };
  }, []);

  const skus = useMemo(() => new Set(existing.map((x) => clean(x.sku))), [existing]);
  const newRows = useMemo(() => rows.filter((x) => !skus.has(clean(x.sku))), [rows, skus]);
  const allProviders = useMemo(() => [...new Map(newRows.map((x) => [x.proveedorRuc, { nombre: x.proveedorNombre, ruc: x.proveedorRuc }])).values()], [newRows]);
  const newProviderCount = allProviders.filter((x) => !suppliers.some((y) => y.ruc === x.ruc)).length;
  const newCategoryCount = [...new Set(newRows.map((x) => clean(x.categoria)))].filter((x) => !categories.some((y) => clean(y.nombre) === x)).length;
  const mismatch = allProviders.filter((x) => suppliers.some((y) => y.ruc === x.ruc && (clean(y.nombre) !== clean(x.nombre) || !y.activo)));
  const inactiveCategories = newRows.filter((x) => categories.some((y) => clean(y.nombre) === clean(x.categoria) && !y.activa));

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    setRows([]); setFileName(''); setConfirmed(false); setOutcomes([]); setSupplierCreated(0); setCategoryCreated(0); setError(''); setUnits({});
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1024 * 1024) { setError('Selecciona un CSV de máximo 1 MB.'); return; }
    try { setRows(parseCsv(await file.text())); setFileName(file.name); }
    catch (err) { setError(message(err)); }
  };

  const importRows = async () => {
    if (!ready || busy || !confirmed || !newRows.length) return;
    setBusy(true); setError(''); setOutcomes([]); setSupplierCreated(0); setCategoryCreated(0);
    const list: ItemOutcome[] = [];
    let providersCreated = 0;
    let categoriesCreated = 0;
    try {
      // Refrescar TODAS las referencias antes de escribir: hay otras pestañas y usuarios.
      const { cats, prov, prod } = await loadCatalogs();
      const catalog = [...cats];
      const providers = [...prov];
      const skuActual = new Set(prod.map((x) => clean(x.sku)));
      const pending = rows.filter((x) => !skuActual.has(clean(x.sku)));
      // Validar todo el CSV antes de crear el primer registro.
      for (const row of pending) {
        const sameRuc = providers.find((x) => x.ruc === row.proveedorRuc);
        if (sameRuc && (!sameRuc.activo || clean(sameRuc.nombre) !== clean(row.proveedorNombre))) throw new Error(`El RUC ${row.proveedorRuc} ya existe con otro nombre o inactivo. Corrige el CSV antes de continuar.`);
        const sameName = providers.find((x) => clean(x.nombre) === clean(row.proveedorNombre));
        if (sameName && sameName.ruc !== row.proveedorRuc) throw new Error(`El proveedor ${row.proveedorNombre} ya existe con otro RUC.`);
        if (catalog.some((x) => clean(x.nombre) === clean(row.categoria) && !x.activa)) throw new Error(`La categoría ${row.categoria} está inactiva.`);
      }
      // Primero registrar categorías que falten, solo en la base TEST verificada.
      for (const row of pending) {
        if (!catalog.some((x) => clean(x.nombre) === clean(row.categoria))) {
          await checkTestDb();
          const created = await postData<Category>('/categorias', { nombre: row.categoria, descripcion: 'Categoría importada en ambiente TEST' });
          catalog.push(created); categoriesCreated += 1;
        }
      }
      // Luego registrar proveedores únicos, una sola vez por RUC.
      for (const row of pending) {
        if (!providers.some((x) => x.ruc === row.proveedorRuc)) {
          await checkTestDb();
          const created = await postData<Supplier>('/proveedores', {
            nombre: row.proveedorNombre, ruc: row.proveedorRuc, telefono: '', email: '',
          });
          providers.push(created); providersCreated += 1;
        }
      }
      setSupplierCreated(providersCreated); setCategoryCreated(categoriesCreated);
      // Finalmente registrar productos, sin lote inicial ni stock inventado.
      for (const row of rows) {
        if (skuActual.has(clean(row.sku))) {
          list.push({ sku: row.sku, estado: 'omitido', descripcion: 'El SKU ya existe; no se duplicó.' });
          setOutcomes([...list]);
          continue;
        }
        const cat = catalog.find((x) => clean(x.nombre) === clean(row.categoria) && x.activa);
        const sup = providers.find((x) => x.ruc === row.proveedorRuc && x.activo);
        if (!cat || !sup) { list.push({ sku: row.sku, estado: 'error', descripcion: 'Categoría o proveedor no disponible.' }); setOutcomes([...list]); continue; }
        try {
          await checkTestDb();
          await postData<ExistingProduct>('/productos', {
            sku: row.sku, nombre: row.nombre,
            descripcion: 'Catálogo importado en TEST; stock histórico no trasladado.',
            categoriaId: cat.id, proveedorId: sup.id,
            precioVenta: row.precioVenta, stockMinimo: row.stockMinimo,
            unidadMedida: units[row.sku] || row.unidad, loteInicial: null,
          });
          skuActual.add(clean(row.sku));
          list.push({ sku: row.sku, estado: 'creado', descripcion: `Producto creado y vinculado a ${sup.nombre}; stock inicial 0.` });
        } catch (err) { list.push({ sku: row.sku, estado: 'error', descripcion: message(err) }); }
        setOutcomes([...list]);
      }
      await loadCatalogs();
    } catch (err) {
      setError(message(err));
      // Mantener el resultado de los registros realizados si hubo una interrupción.
      try { await loadCatalogs(); } catch { /* Conservar el error original */ }
    } finally {
      setSupplierCreated(providersCreated); setCategoryCreated(categoriesCreated);
      setOutcomes([...list]); setBusy(false);
    }
  };

  const created = outcomes.filter((x) => x.estado === 'creado').length;
  const skipped = outcomes.filter((x) => x.estado === 'omitido').length;
  const failed = outcomes.filter((x) => x.estado === 'error').length;

  return (
    <section className="diza-bulk" aria-labelledby="bulk-title">
      <div className="diza-bulk-head">
        <div><span className="diza-bulk-eyebrow">BODEGA D'IZA · SOLO BASE TEST</span><h1 id="bulk-title">Carga masiva de Inventario</h1><p>Un solo CSV registra proveedores, categorías y productos en PostgreSQL TEST.</p></div>
        <Link className="diza-bulk-back" to="/inventario">← Volver a Inventario</Link>
      </div>
      <div className="diza-bulk-notice" role="note">
        <strong>Proveedores DEMO ficticios.</strong> Los RUC del archivo son simulados y no se deben utilizar en producción. El <code>stock_actual</code> representa abril de 2026: lo mostraremos como referencia, pero los productos se crearán <strong>sin lote inicial, con stock operativo 0</strong>. No se crearán ventas ni movimientos de stock.
      </div>
      {error && <div className="diza-bulk-error" role="alert">{error}</div>}
      {!ready && <p className="diza-bulk-loading">Validando la conexión exclusiva con bodega_diza_test...</p>}
      {ready && <>
        <div className="diza-bulk-panel">
          <h2>1. Seleccionar CSV de productos y proveedores</h2>
          <label className="diza-bulk-file">Archivo CSV combinado<input type="file" accept=".csv,text/csv" onChange={(e) => { void handleFile(e); }} /></label>
          <p className="diza-bulk-help">Selecciona <strong>productos_con_proveedores_demo.csv</strong>. Archivo seleccionado: {fileName || 'ninguno'}.</p>
          {rows.length > 0 && <div className="diza-bulk-stats">
            <span><b>{rows.length}</b> productos leídos</span>
            <span><b>{newRows.length}</b> productos nuevos</span>
            <span><b>{newProviderCount}</b> proveedores por crear</span>
            <span><b>{newCategoryCount}</b> categorías por crear</span>
            <span><b>{rows.length - newRows.length}</b> SKU existentes</span>
          </div>}
        </div>
        {rows.length > 0 && <div className="diza-bulk-panel">
          <h2>2. Revisar el contenido antes de importar</h2>
          <p className="diza-bulk-help">Al confirmar se crearán los proveedores del CSV que aún no existan, después las categorías y los productos. Los productos existentes se omitirán. Puedes cambiar la unidad antes de guardar.</p>
          <div className="diza-bulk-scroll"><table className="diza-bulk-table"><thead><tr>
            <th>SKU</th><th>Producto / categoría</th><th>Proveedor del CSV</th><th>RUC DEMO</th><th>Precio</th><th>Stock mín.</th><th>Stock histórico*</th><th>Unidad</th><th>Estado</th>
          </tr></thead><tbody>
            {rows.map((row) => <tr key={row.sku}>
              <td>{row.sku}</td><td><strong>{row.nombre}</strong><small>{row.categoria}</small></td>
              <td>{row.proveedorNombre}</td><td>{row.proveedorRuc}</td>
              <td>S/ {row.precioVenta.toFixed(2)}</td><td>{row.stockMinimo}</td><td>{row.stockHistorico}</td>
              <td><select aria-label={`Unidad de ${row.sku}`} disabled={busy || skus.has(clean(row.sku))} value={units[row.sku] || row.unidad} onChange={(e) => setUnits((prev) => ({ ...prev, [row.sku]: e.target.value as Unit }))}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
              <td>{skus.has(clean(row.sku)) ? 'Ya existe' : 'Nuevo'}</td>
            </tr>)}
          </tbody></table></div>
          <p className="diza-bulk-help">* Stock histórico solo informativo, no se registrará como stock actual.</p>
          {mismatch.length > 0 && <p className="diza-bulk-error">Hay proveedores cuyo RUC coincide con uno ya registrado, pero el nombre es diferente o están inactivos. Revisa el CSV.</p>}
          {inactiveCategories.length > 0 && <p className="diza-bulk-error">Existen categorías inactivas que deben activarse antes de importar.</p>}
          <label className="diza-bulk-confirm"><input type="checkbox" disabled={busy} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Confirmo que son proveedores ficticios para TEST y que los productos se crearán con stock 0.</label>
          <div className="diza-bulk-submit"><span>{newRows.length} productos y {newProviderCount} proveedores nuevos detectados.</span>
            <button type="button" disabled={busy || !confirmed || newRows.length === 0 || mismatch.length > 0 || inactiveCategories.length > 0} onClick={() => { void importRows(); }}>{busy ? 'Importando...' : 'Importar productos y proveedores a TEST'}</button>
          </div>
        </div>}
        {(outcomes.length > 0 || supplierCreated > 0 || categoryCreated > 0) && <div className="diza-bulk-panel" role="status">
          <h2>3. Resultado de importación</h2>
          <div className="diza-bulk-stats"><span><b>{supplierCreated}</b> proveedores creados</span><span><b>{categoryCreated}</b> categorías creadas</span><span><b>{created}</b> productos creados</span><span><b>{skipped}</b> omitidos</span><span><b>{failed}</b> errores</span></div>
          <ul className="diza-bulk-results">{outcomes.map((item) => <li key={item.sku}><strong>{item.sku}</strong> — {item.estado}: {item.descripcion}</li>)}</ul>
          <Link className="diza-bulk-back" to="/inventario">Ver productos en Inventario →</Link>
        </div>}
      </>}
    </section>
  );
};

export default BulkInventoryCsvPage;
