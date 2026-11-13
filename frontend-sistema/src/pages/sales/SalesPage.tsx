import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  productosHistoricos, resumenHistorico, productosOperativos, ventasOperativas, registrarVenta,
  type ProductoHistorico, type ProductoOperativo, type VentaOperativa,
} from '../../services/testDataService';
import { historyReport, type HistoryReport } from '../../services/periodReportService';
import {
  PeriodControls, dateInRange, formatMoney, formatNumber, getPeriodRange, todayLocal,
  type PeriodMode,
} from '../../components/period/PeriodControls';
import '../demo/demo.css';
import './sales-trend.css';

type Modo = 'historico' | 'operativo' | 'unificado';
const numeric = (v: unknown) => Number(v ?? 0);
const agruparPorFecha = (list: VentaOperativa[], modo: PeriodMode) => {
  const groups = new Map<string,number>();
  for(const v of list) {
    const d = v.fecha.slice(0,10);
    const key = modo === 'todo' ? d.slice(0,7) : modo === 'mes' ? d : modo === 'anio' ? d.slice(0,7) : modo === 'semana' ? d : d;
    groups.set(key,(groups.get(key)||0)+numeric(v.total));
  }
  return Array.from(groups.entries()).map(([periodo,ingresos])=>({periodo,ingresos})).sort((a,b)=>a.periodo.localeCompare(b.periodo));
};


// Etiquetas en español para los períodos agrupados por el reporte histórico.
// El backend retorna fechas ISO: para los meses, el primer día representa el mes completo.
type TrendUnit = 'dia' | 'mes';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ABR_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function readablePeriod(raw: string, grouping: TrendUnit): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return raw;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return raw;
  }
  return grouping === 'mes'
    ? `${MESES[month - 1][0].toUpperCase()}${MESES[month - 1].slice(1)} ${year}`
    : `${day} ${ABR_MES[month - 1]}`;
}

function readableFullDate(raw: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return raw;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return raw;
  return `${Number(match[3])} ${ABR_MES[month - 1]} ${match[1]}`;
}

function SalesRevenueBars({ data, grouping }: {
  data: { periodo: string; ingresos: number }[];
  grouping: TrendUnit;
}) {
  if (!data.length) {
    return <p className="diza-period-empty">No hay ingresos para el período seleccionado.</p>;
  }
  const max = Math.max(1, ...data.map(item => numeric(item.ingresos)));
  return <div className="diza-sales-trend-scroll" role="region" tabIndex={0}
    aria-label="Gráfico de ingresos; puedes desplazarte horizontalmente para ver todas las fechas">
    <div className="diza-sales-trend-chart">
      {data.map(item => {
        const ingresos = Math.max(0, numeric(item.ingresos));
        const label = readablePeriod(item.periodo, grouping);
        return <div key={item.periodo} className="diza-sales-trend-col"
          title={`${label}: ${formatMoney(ingresos)}`}>
          <strong>{formatMoney(ingresos)}</strong>
          <div className="diza-sales-trend-track">
            <span style={{ height: `${ingresos === 0 ? 0 : Math.max(3, ingresos / max * 100)}%` }} />
          </div>
          <small>{label}</small>
        </div>;
      })}
    </div>
  </div>;
}

export const SalesPage = () => {
  const [modo,setModo] = useState<Modo>('historico');
  const [periodo,setPeriodo] = useState<PeriodMode>('mes');
  const [anchor,setAnchor] = useState(todayLocal());
  const [histProducts,setHistProducts] = useState<ProductoHistorico[]>([]);
  const [filter,setFilter] = useState('');
  const [page,setPage] = useState(0);
  const [report,setReport] = useState<HistoryReport|null>(null);
  const [trendView,setTrendView] = useState<'diario' | 'mensual'>('diario');
  const [trendReport,setTrendReport] = useState<HistoryReport|null>(null);
  const [trendLoading,setTrendLoading] = useState(false);
  const [trendError,setTrendError] = useState('');
  const [opProducts,setOpProducts] = useState<ProductoOperativo[]>([]);
  const [opSales,setOpSales] = useState<VentaOperativa[]>([]);
  const [productId,setProductId] = useState('');
  const [amount,setAmount] = useState(1);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const range=useMemo(()=>getPeriodRange(periodo,anchor),[periodo,anchor]);
  // El período de los indicadores no cambia; solamente la agrupación visual del gráfico.
  const trendGrouping: TrendUnit = periodo === 'mes' && trendView === 'mensual'
    ? 'mes' : (periodo === 'anio' || periodo === 'todo' ? 'mes' : 'dia');

  const refreshOperational = useCallback(async()=>{
    const [p,v]=await Promise.all([productosOperativos(),ventasOperativas()]);
    setOpProducts(p); setOpSales(v);
  },[]);

  useEffect(()=>{
    let active=true;
    void Promise.all([productosHistoricos(),resumenHistorico(),refreshOperational()]).then(([p,s])=>{
      if(!active)return;
      setHistProducts(p);
      if(s.hasta) setAnchor(s.hasta);
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudieron consultar datos');});
    return()=>{active=false;};
  },[refreshOperational]);

  useEffect(()=>{
    if(modo==='operativo') return;
    let active=true;
    setLoading(true);setError('');
    void historyReport(range,filter,periodo,page).then(r=>{if(active)setReport(r);})
      .catch(e=>{if(active){setReport(null);setError(e instanceof Error?e.message:'Error de reporte histórico');}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[modo,range,filter,periodo,page]);

  // Consulta de solo lectura: el backend devuelve TODOS los puntos de la tendencia,
  // independientemente de que la tabla de detalle esté paginada a 40 filas.
  useEffect(() => {
    if (modo === 'operativo') return;
    let active = true;
    setTrendLoading(true);
    setTrendReport(null);
    setTrendError('');
    void historyReport(range, filter, trendGrouping, 0)
      .then(result => { if (active) setTrendReport(result); })
      .catch(err => {
        if (active) setTrendError(err instanceof Error ? err.message : 'No se pudo consultar la tendencia');
      })
      .finally(() => { if (active) setTrendLoading(false); });
    return () => { active = false; };
  }, [modo, range, filter, trendGrouping]);

  const filteredOperational=useMemo(()=>opSales.filter(v=>dateInRange(v.fecha,range)),[opSales,range]);
  const operationalRevenue=filteredOperational.reduce((sum,v)=>sum+numeric(v.total),0);
  const totalPages=Math.max(1,Math.ceil(numeric(report?.filas)/40));
  const changeMode=(next:Modo)=>{
    setModo(next);setMessage('');setPage(0);setFilter('');setError('');
    setPeriodo(next==='unificado'?'todo':'mes');
    if(next==='operativo' || next==='unificado') setAnchor(todayLocal());
    else void resumenHistorico().then(s=>{if(s.hasta)setAnchor(s.hasta);}).catch(()=>{});
  };
  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    if(!productId||amount<=0||busy)return;
    setBusy(true);setMessage('');setError('');
    try{
      const sale=await registrarVenta(Number(productId),amount);
      setMessage(`Venta #${sale.id} registrada correctamente. El inventario descontó ${amount} unidades.`);
      await refreshOperational();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo registrar venta');}
    finally{setBusy(false);}
  };

  return <main className="diza-test-page">
    <header className="diza-test-heading"><div><span className="diza-test-eyebrow">BODEGA D'IZA · REPORTES ORGANIZADOS</span><h1>Ventas</h1><p>Consulta por día, semana, mes o año sin alterar el historial ni el stock.</p></div><Link to="/datos-prueba" className="diza-test-link">Importar histórico CSV →</Link></header>
    <div className="diza-test-tabs" role="group" aria-label="Origen de las ventas">
      <button aria-pressed={modo==='historico'} onClick={()=>changeMode('historico')}>Histórico CSV</button>
      <button aria-pressed={modo==='operativo'} onClick={()=>changeMode('operativo')}>Ventas operativas</button>
      <button aria-pressed={modo==='unificado'} onClick={()=>changeMode('unificado')}>Vista general</button>
    </div>
    <PeriodControls mode={periodo} setMode={v=>{setPeriodo(v);setPage(0);}} anchor={anchor} setAnchor={v=>{setAnchor(v);setPage(0);}} />
    {error&&<p className="diza-test-error" role="alert">{error}</p>}
    {message&&<p className="diza-test-success" role="status">{message}</p>}
    {(modo==='historico'||modo==='unificado')&&<>
      <section className="diza-test-panel">
        <div className="diza-test-heading"><div><h2>Ventas históricas · análisis</h2><p className="diza-kpi-note">Son unidades diarias por producto, no tickets; nunca descuentan stock.</p></div><label>Producto <select className="diza-test-input" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="">Todos</option>{histProducts.map(p=><option value={p.id} key={p.id}>{p.id} · {p.nombre}</option>)}</select></label></div>
        <div className="diza-stat-grid">
          <div className="diza-stat"><span>Registros diarios</span><strong>{formatNumber(numeric(report?.filas))}</strong></div>
          <div className="diza-stat"><span>Unidades vendidas</span><strong>{formatNumber(numeric(report?.unidades))}</strong></div>
          <div className="diza-stat"><span>Ingresos referenciales</span><strong>{formatMoney(numeric(report?.ingresos))}</strong></div>
          <div className="diza-stat"><span>Productos con ventas</span><strong>{formatNumber(numeric(report?.productos))}</strong></div>
        </div>
        <div className="diza-sales-trend-heading">
          <div>
            <h3>Ingresos históricos por {trendGrouping === 'dia' ? 'día' : 'mes'}</h3>
            <p className="diza-kpi-note">{periodo === 'mes' && trendView === 'mensual'
              ? 'El total corresponde a todo el mes, no solamente al primer día.'
              : 'Los importes son referenciales y no se suman a las ventas operativas.'}</p>
          </div>
          {periodo === 'mes' && <div className="diza-sales-trend-switch" role="group"
            aria-label="Agrupar ingresos del mes">
            <button type="button" aria-pressed={trendView === 'diario'}
              onClick={() => setTrendView('diario')}>Por día</button>
            <button type="button" aria-pressed={trendView === 'mensual'}
              onClick={() => setTrendView('mensual')}>Resumen mensual</button>
          </div>}
        </div>
        {trendLoading || loading
          ? <p className="diza-test-muted">Calculando tendencia...</p>
          : trendError
            ? <p className="diza-test-error" role="alert">{trendError}</p>
            : <SalesRevenueBars grouping={trendGrouping}
                data={(trendReport?.tendencia || []).map(x => ({ periodo: x.periodo, ingresos: numeric(x.ingresos) }))} />}
        {periodo === 'mes' && trendGrouping === 'dia' && !trendLoading && !loading && !trendError &&
          <p className="diza-kpi-note">Desliza el gráfico horizontalmente para consultar los demás días del mes.</p>}
        <div className="diza-test-overflow"><table className="diza-test-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Unidades</th><th>Ingreso referencial</th><th>Stock histórico cierre</th></tr></thead><tbody>{(report?.registros||[]).map(v=><tr key={`${v.fecha}-${v.id}`}><td>{readableFullDate(v.fecha)}</td><td>{v.id} · {v.nombre}</td><td>{formatNumber(numeric(v.cantidad))}</td><td>{formatMoney(numeric(v.cantidad)*numeric(v.precio))}</td><td>{formatNumber(numeric(v.stockFinal))}</td></tr>)}</tbody></table></div>
        {!loading&&report?.registros.length===0&&<p className="diza-test-muted">No hay ventas históricas para el período seleccionado.</p>}
        <div className="diza-pagination"><span className="diza-kpi-note">Página {page+1} de {totalPages} · 40 filas por página</span><button disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>← Anterior</button><button disabled={page+1>=totalPages||loading} onClick={()=>setPage(p=>p+1)}>Siguiente →</button></div>
      </section>
    </>}
    {(modo==='operativo'||modo==='unificado')&&<>
      <section className="diza-test-panel">
        <h2>Ventas operativas · movimientos reales de TEST</h2>
        <p className="diza-kpi-note">Estas sí registran tickets y descuentan el stock de los lotes. Se mantienen separadas del histórico importado.</p>
        <div className="diza-stat-grid">
          <div className="diza-stat"><span>Tickets registrados</span><strong>{filteredOperational.length}</strong></div>
          <div className="diza-stat"><span>Ingresos operativos</span><strong>{formatMoney(operationalRevenue)}</strong></div>
          <div className="diza-stat"><span>Ticket promedio</span><strong>{formatMoney(filteredOperational.length?operationalRevenue/filteredOperational.length:0)}</strong></div>
          <div className="diza-stat"><span>Productos operativos</span><strong>{opProducts.length}</strong></div>
        </div>
        <div className="diza-sales-trend-heading"><h3>Ingresos operativos por {periodo === 'todo' || periodo === 'anio' ? 'mes' : 'día'}</h3></div>
        <SalesRevenueBars data={agruparPorFecha(filteredOperational,periodo)} grouping={periodo === 'todo' || periodo === 'anio' ? 'mes' : 'dia'} />
        <div className="diza-test-overflow"><table className="diza-test-table"><thead><tr><th>ID</th><th>Fecha</th><th>Total</th></tr></thead><tbody>{filteredOperational.slice(0,80).map(v=><tr key={v.id}><td>#{v.id}</td><td>{v.fecha.replace('T',' ')}</td><td>{formatMoney(v.total)}</td></tr>)}</tbody></table></div>
        {!filteredOperational.length&&<p className="diza-test-muted">No hay tickets registrados en este período.</p>}
      </section>
      {modo==='operativo'&&<section className="diza-test-panel"><h2>Registrar venta (TEST)</h2>
        <form className="diza-test-form" onSubmit={e=>{void submit(e);}}>
          <label>Producto con stock disponible<select value={productId} onChange={e=>setProductId(e.target.value)} required><option value="">Selecciona un producto</option>{opProducts.filter(p=>p.activo&&p.stockTotal>0).map(p=><option value={p.id} key={p.id}>{p.sku} · {p.nombre} · Stock {p.stockTotal}</option>)}</select></label>
          <label>Cantidad<input type="number" value={amount} onChange={e=>setAmount(Number(e.target.value))} min="1" step="1" required/></label>
          <button type="submit" disabled={!productId||amount<=0||busy}>{busy?'Registrando...':'Registrar venta'}</button>
        </form>
        {!opProducts.some(p=>p.stockTotal>0&&p.activo)&&<p className="diza-test-muted">Primero registra una entrada de inventario; todos los productos tienen stock 0.</p>}
      </section>}
    </>}
    {modo==='unificado'&&<p className="diza-test-note">Vista general: ambos orígenes se muestran por separado. No se suman como tickets las 2,400 filas del CSV ni se descuenta stock histórico por segunda vez.</p>}
  </main>;
};
export default SalesPage;
