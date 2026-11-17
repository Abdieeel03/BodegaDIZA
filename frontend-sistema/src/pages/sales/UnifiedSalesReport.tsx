import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, StatCard, TableFrame, StatusBadge } from '../../components/ui';
import { DataFeedback } from '../../components/common/DataFeedback';
import { SalesHistoryChart } from '../../components/charts/SalesHistoryChart';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { getSalesReport, peruToday, salesDateLabel, type SalesGrouping, type SalesOrigin } from '../../services/salesReportService';
import { getPeriodRange, formatMoney } from '../../components/period/PeriodControls';
import './unified-sales.css';

export function UnifiedSalesReport({ revision }: { revision: number }) {
  const [params, setParams] = useSearchParams();
  const today = peruToday();
  const from = params.get('desde') ?? `${today.slice(0, 7)}-01`;
  const to = params.get('hasta') ?? today;
  const sku = params.get('sku') ?? '';
  const origin = (['todos', 'historico', 'operativo'].includes(params.get('origen') ?? '') ? params.get('origen') : 'todos') as SalesOrigin;
  const grouping = (['dia', 'semana', 'mes'].includes(params.get('agrupacion') ?? '') ? params.get('agrupacion') : 'dia') as SalesGrouping;
  const page = Math.min(100000, Math.max(0, Number(params.get('pagina')) || 0));
  const [manualRefresh, setManualRefresh] = useState(0);
  const validDates = (!from || /^\d{4}-\d{2}-\d{2}$/.test(from)) && (!to || /^\d{4}-\d{2}-\d{2}$/.test(to)) && (!from || !to || from <= to);
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    next.set('pagina', '0');
    Object.entries(values).forEach(([key, value]) => next.set(key, value));
    setParams(next, { replace: true });
  };
  const loader = useCallback((signal: AbortSignal) => {
    void revision; void manualRefresh;
    return getSalesReport({ desde: from || undefined, hasta: to || undefined, sku, origen: origin, agrupacion: grouping, pagina: page }, signal);
  }, [from, to, sku, origin, grouping, page, revision, manualRefresh]);
  const { data, status, error } = useRemoteResource(loader, validDates);
  const retry = () => setManualRefresh(value => value + 1);
  const preset = (mode: 'dia' | 'semana' | 'mes' | 'anio' | 'todo') => {
    const range = getPeriodRange(mode, today);
    update({ desde: range.desde ?? '', hasta: range.hasta && range.hasta < today ? range.hasta : mode === 'todo' ? '' : today,
      agrupacion: mode === 'anio' || mode === 'todo' ? 'mes' : 'dia' });
  };
  // Mantener las opciones durante una recarga sin mostrar cifras del filtro anterior.
  const [catalog, setCatalog] = useState<{ sku: string; nombre: string }[]>([]);
  const shownCatalog = data?.catalogo ?? catalog;
  useEffect(() => { if (data) setCatalog(data.catalogo); }, [data]);

  return <section className="diza-sales-report" aria-label="Reporte de ventas">
    <div className="diza-test-panel diza-sales-filter-panel">
      <div className="diza-sales-presets" aria-label="Períodos rápidos">
        {([['dia', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['anio', 'Este año'], ['todo', 'Todo el historial']] as const).map(([mode, label]) =>
          <Button key={mode} variant="secondary" size="sm" onClick={() => preset(mode)}>{label}</Button>)}
      </div>
      <div className="diza-sales-filters">
        <label>Desde<input type="date" value={from} onChange={event => update({ desde: event.target.value })} /></label>
        <label>Hasta<input type="date" value={to} onChange={event => update({ hasta: event.target.value })} /></label>
        <label>Producto<select value={sku} onChange={event => update({ sku: event.target.value })}>
          <option value="">Todos los productos</option>{shownCatalog.map(product => <option key={product.sku} value={product.sku}>{product.sku} · {product.nombre}</option>)}
        </select></label>
        <label>Origen<select value={origin} onChange={event => update({ origen: event.target.value })}>
          <option value="todos">Todas las ventas</option><option value="historico">Histórico importado</option><option value="operativo">Ventas operativas</option>
        </select></label>
        <label>Agrupar gráfico<select value={grouping} onChange={event => update({ agrupacion: event.target.value })}>
          <option value="dia">Por día</option><option value="semana">Por semana</option><option value="mes">Por mes</option>
        </select></label>
      </div>
      <p className="diza-kpi-note">Los filtros se aplican a los indicadores, el gráfico y el detalle diario.</p>
    </div>
    {!validDates ? <p className="diza-test-error" role="alert">Selecciona un rango válido: Desde debe ser anterior o igual a Hasta.</p>
      : status === 'loading' ? <DataFeedback status="loading" title="Consultando ventas" />
      : status === 'error' ? <DataFeedback status="error" description={error ?? undefined} onRetry={retry} />
      : data && <>
        {!data.historicoDisponible && origin !== 'operativo' && <p className="diza-test-note" role="status">Esta base no tiene un histórico importado. {origin === 'historico' ? 'Selecciona Todas las ventas o Ventas operativas para consultar los registros disponibles.' : 'Se muestran las ventas operativas disponibles.'}</p>}
        {data.coincidencias > 0 && <p className="diza-sales-overlap" role="status">Hay {data.coincidencias} coincidencias de producto y fecha entre ambos orígenes. Podrían incluir ventas repetidas: consulta cada origen por separado hasta conciliarlas. El total consolidado no se calcula.</p>}
        <div className="diza-stat-grid">
          <StatCard label="Importe del período" value={data.total === null ? 'Por conciliar' : formatMoney(data.total)} note={origin === 'todos' ? 'Incluye el histórico seleccionado' : origin === 'historico' ? 'Importe histórico referencial' : 'Ventas registradas'} />
          <StatCard label="Histórico importado" value={formatMoney(data.historico)} note="Cantidad × precio histórico" />
          <StatCard label="Ventas operativas" value={formatMoney(data.operativo)} note={`${data.tickets} ${data.tickets === 1 ? 'ticket' : 'tickets'} con los productos seleccionados`} />
          <StatCard label="Productos con ventas" value={data.productos} note={`${data.filas} registros diarios por origen`} />
        </div>
        <section className="diza-test-panel"><h2>Evolución de ventas</h2>
          <SalesHistoryChart points={data.tendencia} grouping={grouping} origin={origin} />
        </section>
        <section className="diza-test-panel"><h2>Detalle de ventas por día y producto</h2>
          <p className="diza-kpi-note">Los tickets se agrupan por producto y día. Las cantidades históricas conservan la unidad del archivo original.</p>
          <TableFrame label="Ventas diarias históricas y operativas"><table className="diza-test-table">
            <thead><tr>{['Fecha', 'Producto', 'Cantidad', 'Importe', 'Origen', 'Stock histórico al cierre'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{data.registros.map(row => <tr key={`${row.fecha}-${row.sku}-${row.origen}`}>
              <td>{salesDateLabel(row.fecha)}</td><td><strong>{row.nombre}</strong><small className="diza-sales-sku">{row.sku}</small></td>
              <td>{Number(row.cantidad).toLocaleString('es-PE', { maximumFractionDigits: 3 })} {row.unidad?.toLowerCase() ?? '(según histórico)'}</td>
              <td>{formatMoney(row.importe)}</td><td><StatusBadge tone="neutral">{row.origen === 'historico' ? 'Histórico' : 'Operativo'}</StatusBadge></td>
              <td>{row.stockCierre === null ? '—' : Number(row.stockCierre).toLocaleString('es-PE')}</td>
            </tr>)}</tbody>
          </table></TableFrame>
          {!data.filas && <DataFeedback status="empty" title="Sin ventas para estos filtros" description="Prueba otro período, producto u origen." />}
          <nav className="diza-sales-pagination" aria-label="Paginación del reporte">
            <span>{data.filas ? `${data.pagina * data.tamanio + 1}–${Math.min((data.pagina + 1) * data.tamanio, data.filas)} de ${data.filas} registros` : '0 registros'}</span>
            <div><Button variant="secondary" size="sm" disabled={data.pagina === 0} onClick={() => update({ pagina: String(data.pagina - 1) })}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={(data.pagina + 1) * data.tamanio >= data.filas} onClick={() => update({ pagina: String(data.pagina + 1) })}>Siguiente</Button></div>
          </nav>
        </section>
      </>}
  </section>;
}
