import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, StatCard, TableFrame } from '../../components/ui';
import { SaleRegistrationForm } from './SaleRegistrationForm';
import {
  productosHistoricos, productosOperativos, ventasOperativas, registrarVentaConItems,
  type ProductoHistorico, type ProductoOperativo, type VentaOperativa, type SaleItemPayload,
} from '../../services/testDataService';
import { historyReport, type HistoryReport } from '../../services/periodReportService';
import {
  PeriodControls, dateInRange, formatMoney, formatNumber, getPeriodRange, todayLocal,
  type PeriodMode,
} from '../../components/period/PeriodControls';
import '../demo/demo.css';
import './sales-trend.css';

type Modo = 'historico' | 'operativo' | 'unificado';
const TICKETS_PER_PAGE = 20;
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
  const [modo,setModo] = useState<Modo>('operativo');
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
  const [ticketQuery, setTicketQuery] = useState('');
  const [ticketPage, setTicketPage] = useState(1);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(false);
  const [operationalLoading,setOperationalLoading] = useState(false);
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
    if (modo === 'historico') return;
    let active=true;
    setOperationalLoading(true);
    void refreshOperational().catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudieron cargar las ventas');})
      .finally(()=>{if(active)setOperationalLoading(false);});
    return()=>{active=false;};
  },[modo,refreshOperational]);

  useEffect(()=>{
    if (modo === 'operativo') return;
    let active=true;
    void productosHistoricos().then(p=>{if(active)setHistProducts(p);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudo cargar el catálogo histórico');});
    return()=>{active=false;};
  },[modo]);

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

  const filteredOperational = useMemo(
    () => opSales.filter(v => dateInRange(v.fecha, range)), [opSales, range],
  );
  const operationalRevenue = filteredOperational.reduce((sum, v) => sum + numeric(v.total), 0);
  // El buscador afecta solo la tabla: los KPIs y el gráfico siguen representando el período completo.
  const operationalRows = useMemo(() => {
    const query = ticketQuery.trim().replace(/^#/, '');
    return filteredOperational
      .filter(v => !query || String(v.id).includes(query))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }, [filteredOperational, ticketQuery]);
  const ticketTotalPages = Math.max(1, Math.ceil(operationalRows.length / TICKETS_PER_PAGE));
  const actualTicketPage = Math.min(ticketPage, ticketTotalPages);
  const visibleTickets = operationalRows.slice(
    (actualTicketPage - 1) * TICKETS_PER_PAGE, actualTicketPage * TICKETS_PER_PAGE,
  );
  const totalPages=Math.max(1,Math.ceil(numeric(report?.filas)/40));
  const changeMode=(next:Modo)=>{
    setModo(next);setMessage('');setPage(0);setFilter('');setError('');
    setTicketQuery('');setTicketPage(1);
    setPeriodo(next==='operativo'?'mes':'todo');
    if(next==='operativo') setAnchor(todayLocal());

  };
  const registerSale = async (items: SaleItemPayload[]): Promise<boolean> => {
    if (busy || !items.length) return false;
    setBusy(true); setMessage(''); setError('');
    try {
      const sale = await registrarVentaConItems(items);
      setMessage(`Venta #${sale.id} registrada correctamente con ${items.length} producto(s). El inventario se actualizó en el servidor.`);
      setTicketPage(1); setTicketQuery('');
      // Una falla al releer el listado NO significa que el registro haya fallado.
      try {
        await refreshOperational();
      } catch {
        setError('La venta se registró, pero no fue posible actualizar el listado. Vuelve a abrir Ventas para consultar los cambios.');
      }
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo registrar la venta.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return <main className="diza-test-page">
    <PageHeader title="Ventas"
      description="Registra y consulta ventas."
      actions={modo==='historico' ? <Link to="/ventas/importar-historico" className="diza-test-link">Importar histórico →</Link> : undefined} />
    <div className="diza-test-tabs" role="group" aria-label="Origen de las ventas">
      <button aria-pressed={modo==='unificado'} onClick={()=>changeMode('unificado')}>Vista general</button>
      <button aria-pressed={modo==='operativo'} onClick={()=>changeMode('operativo')}>Ventas registradas</button>
      <button aria-pressed={modo==='historico'} onClick={()=>changeMode('historico')}>Histórico importado</button>
    </div>
    <PeriodControls mode={periodo} setMode={v=>{setPeriodo(v);setPage(0);setTicketPage(1);}} anchor={anchor} setAnchor={v=>{setAnchor(v);setPage(0);setTicketPage(1);}} />
    {modo !== 'operativo' && error && <p className="diza-test-error" role="alert">{error}</p>}
    {modo==='unificado'&&<p className="diza-test-note">Consulta ambos orígenes con el mismo período. Los importes históricos y las ventas registradas se muestran por separado para evitar contar una venta dos veces. El filtro de producto afecta solo al histórico.</p>}
    {modo !== 'operativo' && message && <p className="diza-test-success" role="status">{message}</p>}
    {(modo==='historico'||modo==='unificado')&&<>
      <section className="diza-test-panel">
        <div className="diza-test-heading"><div><h2>Ventas históricas · análisis</h2><p className="diza-kpi-note">Son unidades diarias por producto, no tickets; nunca descuentan stock.</p></div><label>Producto <select className="diza-test-input" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="">Todos</option>{histProducts.map(p=><option value={p.id} key={p.id}>{p.id} · {p.nombre}</option>)}</select></label></div>
        <div className="diza-stat-grid">
          <StatCard label="Registros diarios" value={formatNumber(numeric(report?.filas))} />
          <StatCard label="Unidades vendidas" value={formatNumber(numeric(report?.unidades))} />
          <StatCard label="Ingresos referenciales" value={formatMoney(numeric(report?.ingresos))} />
          <StatCard label="Productos con ventas" value={formatNumber(numeric(report?.productos))} />
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
        <TableFrame label="Tabla de ventas históricas" className="diza-test-overflow"><table className="diza-test-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Unidades</th><th>Ingreso referencial</th><th>Stock histórico cierre</th></tr></thead><tbody>{(report?.registros||[]).map(v=><tr key={`${v.fecha}-${v.id}`}><td>{readableFullDate(v.fecha)}</td><td>{v.id} · {v.nombre}</td><td>{formatNumber(numeric(v.cantidad))}</td><td>{formatMoney(numeric(v.cantidad)*numeric(v.precio))}</td><td>{formatNumber(numeric(v.stockFinal))}</td></tr>)}</tbody></table></TableFrame>
        {!loading&&report?.registros.length===0&&<p className="diza-test-muted">No hay ventas históricas para el período seleccionado.</p>}
        <div className="diza-pagination"><span className="diza-kpi-note">Página {page+1} de {totalPages} · 40 filas por página</span><button disabled={page===0||loading} onClick={()=>setPage(p=>p-1)}>← Anterior</button><button disabled={page+1>=totalPages||loading} onClick={()=>setPage(p=>p+1)}>Siguiente →</button></div>
      </section>
    </>}
    {(modo==='operativo'||modo==='unificado')&&<>
      {modo === 'operativo' && <section className="diza-test-panel" aria-label="Registrar venta">
        <h2>Registrar venta</h2>
        <p className="diza-kpi-note">El sistema verifica las existencias antes de registrar la venta.</p>
        <SaleRegistrationForm products={opProducts} busy={busy} loading={operationalLoading} onRegister={registerSale} />
        {error && <p className="diza-test-error" role="alert">{error}</p>}
        {message && <p className="diza-test-success" role="status">{message}</p>}
      </section>}
      <section className="diza-test-panel">
        <h2>Ventas registradas</h2>
        {operationalLoading&&<p role="status">Cargando ventas registradas...</p>}
        <div className="diza-stat-grid">
          <StatCard label="Tickets registrados" value={filteredOperational.length} />
          <StatCard label="Total vendido" value={formatMoney(operationalRevenue)} />
          <StatCard label="Ticket promedio" value={formatMoney(filteredOperational.length?operationalRevenue/filteredOperational.length:0)} />
          <StatCard label="Productos en catálogo" value={opProducts.length} />
        </div>
        <div className="diza-sales-trend-heading"><h3>Ventas por {periodo === 'todo' || periodo === 'anio' ? 'mes' : 'día'}</h3></div>
        <SalesRevenueBars data={agruparPorFecha(filteredOperational,periodo)} grouping={periodo === 'todo' || periodo === 'anio' ? 'mes' : 'dia'} />
        <div className="diza-sale-list-head">
          <div>
            <h3>Tickets del período</h3>
            <p className="diza-kpi-note">La búsqueda no modifica los indicadores.</p>
          </div>
          <label className="diza-sale-search" htmlFor="sale-ticket-search">
            Buscar número de ticket
            <input id="sale-ticket-search" type="search" placeholder="Ej. 125" value={ticketQuery}
              onChange={event => { setTicketQuery(event.target.value); setTicketPage(1); }} />
          </label>
        </div>
        <TableFrame label="Tabla de ventas registradas" className="diza-test-overflow">
          <table className="diza-test-table diza-sale-operations-table">
            <thead><tr><th scope="col">Ticket</th><th scope="col">Fecha</th><th scope="col">Total</th></tr></thead>
            <tbody>{visibleTickets.map(v => <tr key={v.id}>
              <td>#{v.id}</td><td>{v.fecha.replace('T', ' ')}</td><td>{formatMoney(v.total)}</td>
            </tr>)}</tbody>
          </table>
        </TableFrame>
        {!operationalLoading && !operationalRows.length && (
          <p className="diza-test-muted" role="status">
            {filteredOperational.length ? 'No se encontraron tickets con ese número.' : 'No hay tickets registrados en este período.'}
          </p>
        )}
        {operationalRows.length > 0 && <nav className="diza-sale-pagination" aria-label="Paginación de tickets">
          <span>Mostrando {(actualTicketPage - 1) * TICKETS_PER_PAGE + 1}–{Math.min(actualTicketPage * TICKETS_PER_PAGE, operationalRows.length)} de {operationalRows.length} tickets</span>
          <div className="diza-sale-pagination-controls">
            <button type="button" disabled={actualTicketPage === 1 || operationalLoading}
              onClick={() => setTicketPage(p => Math.max(1, p - 1))}>← Anterior</button>
            <strong>Página {actualTicketPage} de {ticketTotalPages}</strong>
            <button type="button" disabled={actualTicketPage >= ticketTotalPages || operationalLoading}
              onClick={() => setTicketPage(p => Math.min(ticketTotalPages, p + 1))}>Siguiente →</button>
          </div>
        </nav>}
      </section>

    </>}
  </main>;
};
export default SalesPage;
