import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, StatCard, TableFrame } from '../../components/ui';
import { DataFeedback } from '../../components/common/DataFeedback';
import { SalesHistoryChart } from '../../components/charts/SalesHistoryChart';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { getSalesReport, peruToday, salesDateLabel, type SalesGrouping } from '../../services/salesReportService';
import { getPeriodRange, formatMoney } from '../../components/period/PeriodControls';
import './unified-sales.css';

export function UnifiedSalesReport({ revision }: { revision: number }) {
  const [params, setParams] = useSearchParams();
  const today = peruToday();
  const from = params.get('desde') ?? `${today.slice(0, 7)}-01`;
  const to = params.get('hasta') ?? today;
  const sku = params.get('sku') ?? '';
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
    return getSalesReport({ desde: from || undefined, hasta: to || undefined, sku, origen: 'todos', agrupacion: grouping, pagina: page }, signal);
  }, [from, to, sku, grouping, page, revision, manualRefresh]);
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
        <div className="diza-stat-grid">
          <StatCard label="Total de ventas" value={data.total === null ? '—' : formatMoney(data.total)} note="Importe del período seleccionado" />
          <StatCard label="Tickets" value={data.tickets} note={`${data.tickets === 1 ? 'Ticket registrado' : 'Tickets registrados'} en el período`} />
          <StatCard label="Productos con ventas" value={data.productos} note={`${data.filas} registros diarios`} />
        </div>
        <section className="diza-test-panel"><h2>Evolución de ventas</h2>
          <SalesHistoryChart points={data.tendencia} grouping={grouping} />
        </section>
        <section className="diza-test-panel"><h2>Detalle de ventas por día y producto</h2>
          <p className="diza-kpi-note">Los tickets se agrupan por producto y día.</p>
          <TableFrame label="Ventas diarias"><table className="diza-test-table">
            <thead><tr>{['Fecha', 'Producto', 'Cantidad', 'Importe'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{data.registros.map(row => <tr key={`${row.fecha}-${row.sku}-${row.origen}`}>
              <td>{salesDateLabel(row.fecha)}</td><td><strong>{row.nombre}</strong><small className="diza-sales-sku">{row.sku}</small></td>
              <td>{Number(row.cantidad).toLocaleString('es-PE', { maximumFractionDigits: 3 })} {row.unidad?.toLowerCase() ?? 'unid.'}</td>
              <td>{formatMoney(row.importe)}</td>
            </tr>)}</tbody>
          </table></TableFrame>
          {!data.filas && <DataFeedback status="empty" title="Sin ventas para estos filtros" description="Prueba otro período o producto." />}
          <nav className="diza-sales-pagination" aria-label="Paginación del reporte">
            <span>{data.filas ? `${data.pagina * data.tamanio + 1}–${Math.min((data.pagina + 1) * data.tamanio, data.filas)} de ${data.filas} registros` : '0 registros'}</span>
            <div><Button variant="secondary" size="sm" disabled={data.pagina === 0} onClick={() => update({ pagina: String(data.pagina - 1) })}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={(data.pagina + 1) * data.tamanio >= data.filas} onClick={() => update({ pagina: String(data.pagina + 1) })}>Siguiente</Button></div>
          </nav>
        </section>
      </>}
  </section>;
}
