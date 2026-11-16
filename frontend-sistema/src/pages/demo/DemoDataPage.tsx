import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  importarCsv, productosHistoricos, resumenHistorico, topProductos,
  type ProductoHistorico, type ResumenHistorico, type TipoCsv, type TopProducto,
} from '../../services/testDataService';
import './demo.css';

const dinero = (n: number) => `S/ ${Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const DemoDataPage = () => {
  const [resumen, setResumen] = useState<ResumenHistorico | null>(null);
  const [productos, setProductos] = useState<ProductoHistorico[]>([]);
  const [top, setTop] = useState<TopProducto[]>([]);
  const [tipo, setTipo] = useState<TipoCsv>('productos');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const recargar = useCallback(async () => {
    try {
      const [r, p, t] = await Promise.all([resumenHistorico(), productosHistoricos(), topProductos()]);
      setResumen(r);
      setProductos(p);
      setTop(t);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron consultar los datos históricos');
    }
  }, []);

  useEffect(() => { void recargar(); }, [recargar]);

  const importar = async (event: FormEvent) => {
    event.preventDefault();
    if (!archivo) return;
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      const resultado = await importarCsv(tipo, archivo);
      setMensaje(`${resultado.filasImportadas} filas guardadas en ${resultado.destino}.`);
      setArchivo(null);
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fallo al importar; revisa la consola de Spring Boot');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <main className="diza-test-page">
      <header className="diza-test-heading">
        <div>
          <span className="diza-test-eyebrow">ENTORNO DE DESARROLLO</span>
          <h1>Carga de datos de prueba</h1>
          <p>Históricos CSV separados del inventario y las ventas operativas.</p>
        </div>
        <Link to="/prediccion-demanda" className="diza-test-link">Ver predicciones →</Link>
      </header>

      <div className="diza-test-note">Esta sección solo funciona con la API TEST (puerto 8081), con DIZA_DEMO_ENABLED=true y autenticación JWT. Los CSV no descuentan stock ni generan tickets reales.</div>
      {error && <p role="alert" className="diza-test-error">{error}</p>}
      {mensaje && <p role="status" className="diza-test-success">{mensaje}</p>}

      <section className="diza-test-metrics" aria-label="Estado de la base TEST">
        <article><span>Productos históricos</span><strong>{resumen?.productos ?? '—'}</strong></article>
        <article><span>Filas de ventas diarias</span><strong>{resumen?.ventasDiarias ?? '—'}</strong></article>
        <article><span>Predicciones cargadas</span><strong>{resumen?.predicciones ?? '—'}</strong></article>
        <article><span>Ingresos históricos referenciales</span><strong>{resumen ? dinero(resumen.ingresos) : '—'}</strong></article>
      </section>

      <section className="diza-test-panel">
        <h2>Importar CSV</h2>
        <p className="diza-test-muted">Orden obligatorio: 1. productos_diza.csv, 2. ventas_diza_limpio.csv, 3. predicciones_demo.csv (generado en Python). Si ya cargaste las tablas con SQL, no vuelvas a importar.</p>
        <form className="diza-test-form" onSubmit={(e) => { void importar(e); }}>
          <label>Tipo de archivo
            <select value={tipo} onChange={e => { setTipo(e.target.value as TipoCsv); setArchivo(null); }}>
              <option value="productos">Productos</option>
              <option value="ventas">Ventas históricas</option>
              <option value="predicciones">Predicciones del modelo</option>
            </select>
          </label>
          <label>Selecciona CSV (UTF-8)
            <input key={tipo} type="file" accept=".csv,text/csv" onChange={e => setArchivo(e.target.files?.[0] ?? null)} required />
          </label>
          <button disabled={ocupado || !archivo} type="submit">{ocupado ? 'Importando…' : 'Importar en base TEST'}</button>
          <button type="button" className="diza-test-secondary" onClick={() => { void recargar(); }}>Actualizar datos</button>
        </form>
      </section>

      <section className="diza-test-panel">
        <h2>Catálogo histórico ({productos.length})</h2>
        <div className="diza-test-overflow">
          <table className="diza-test-table">
            <thead><tr><th>ID</th><th>Producto</th><th>Categoría</th><th>Stock final</th><th>Stock mínimo</th><th>Precio</th></tr></thead>
            <tbody>{productos.map(p => <tr key={p.id}><td>{p.id}</td><td>{p.nombre}</td><td>{p.categoria}</td><td>{p.stock}</td><td>{p.stockMinimo}</td><td>{dinero(p.precio)}</td></tr>)}</tbody>
          </table>
        </div>
        {productos.length === 0 && <p className="diza-test-muted">Todavía no hay catálogo CSV importado.</p>}
      </section>

      <section className="diza-test-panel">
        <h2>Productos más vendidos · histórico</h2>
        <div className="diza-test-overflow"><table className="diza-test-table"><thead><tr><th>Producto</th><th>Unidades</th><th>Ingresos referenciales</th></tr></thead>
          <tbody>{top.map(p => <tr key={p.id}><td>{p.nombre}</td><td>{p.unidades}</td><td>{dinero(p.ingresos)}</td></tr>)}</tbody>
        </table></div>
        {resumen?.desde && <p className="diza-test-muted">Periodo: {resumen.desde} a {resumen.hasta}. Son resúmenes diarios por producto, no comprobantes de venta.</p>}
      </section>
    </main>
  );
};

export default DemoDataPage;
