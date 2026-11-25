import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, StatCard, StatusBadge } from '../../components/ui';
import { DataFeedback } from '../../components/common/DataFeedback';
import { SalesHistoryChart } from '../../components/charts/SalesHistoryChart';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { getSalesReport, peruToday } from '../../services/salesReportService';
import { getOperationalAlerts } from '../../services/alertsService';
import { formatMoney } from '../../components/period/PeriodControls';
import './business-overview.css';

export function BusinessOverview({ revision }: { revision: number }) {
  const [period, setPeriod] = useState<'mes' | 'semestre'>('mes');
  const [retry, setRetry] = useState(0);
  const today = peruToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const startDate = new Date(`${monthStart}T12:00:00Z`);
  startDate.setUTCMonth(startDate.getUTCMonth() - 5);
  const from = period === 'mes' ? monthStart : startDate.toISOString().slice(0, 10);
  const loadSummary = useCallback(async (signal: AbortSignal) => {
    void revision; void retry;
    const [day, month] = await Promise.all([
      getSalesReport({ desde: today, hasta: today }, signal),
      getSalesReport({ desde: monthStart, hasta: today }, signal),
    ]);
    return { day, month, queriedAt: new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }) };
  }, [revision, retry, today, monthStart]);
  const loadHistory = useCallback((signal: AbortSignal) => {
    void revision; void retry;
    return getSalesReport({ desde: from, hasta: today, origen: 'todos', agrupacion: period === 'mes' ? 'dia' : 'mes' }, signal);
  }, [revision, retry, from, today, period]);
  const loadAlerts = useCallback(() => { void revision; void retry; return getOperationalAlerts(); }, [revision, retry]);
  const summary = useRemoteResource(loadSummary, true);
  const history = useRemoteResource(loadHistory, true);
  const alertsResource = useRemoteResource(loadAlerts, true);
  const alerts = alertsResource.data?.alerts ?? [];
  const stockAlerts = alertsResource.data?.stockAlerts ?? [];
  const reload = () => setRetry(value => value + 1);
  const salesLink = `/ventas?desde=${from}&hasta=${today}&agrupacion=${period === 'mes' ? 'dia' : 'mes'}`;
  const metric = (value?: number | null) => summary.status === 'loading' ? 'Consultando…' : value == null ? '—' : formatMoney(value);

  return <section className="diza-business" aria-labelledby="business-title">
    <div className="diza-dashboard-section-heading"><div><h2 id="business-title">Tu bodega hoy</h2>
      <p>Ventas e inventario actual{summary.data ? ` · Consultado a las ${summary.data.queriedAt} (Perú)` : ''}</p></div>
      <div className="diza-business-actions"><Link to="/ventas?registrar=1" className="diza-period-link">Registrar venta</Link><Link to="/inventario" className="diza-dashboard-text-link">Inventario</Link><Link to="/prediccion-demanda/compras" className="diza-dashboard-text-link">Planificar compras</Link></div>
    </div>
    <div className="diza-dashboard-kpis">
      <StatCard label="Ventas de hoy" value={metric(summary.data?.day.total)} note="Total del día" />
      <StatCard label="Ventas del mes" value={metric(summary.data?.month.total)} note="Desde el primer día hasta hoy" />
      <StatCard label="Tickets de hoy" value={summary.status === 'loading' ? 'Consultando…' : summary.data?.day.tickets ?? '—'} />
      <StatCard label="Productos agotados" value={alertsResource.status === 'loading' ? 'Consultando…' : alertsResource.data ? stockAlerts.filter(item => Number(item.stockActual) <= 0).length : '—'} note="Stock disponible actual" />
    </div>
    {summary.status === 'error' && <DataFeedback status="error" title="Resumen de ventas no disponible" description={summary.error ?? undefined} onRetry={reload} />}
    <div className="diza-dashboard-analytics">
      <section className="diza-dashboard-panel" aria-labelledby="business-sales-title">
        <div className="diza-dashboard-panel-heading"><h3 id="business-sales-title">Evolución de ventas</h3>
          <label className="diza-business-period">Período<select value={period} onChange={event => setPeriod(event.target.value as 'mes' | 'semestre')}><option value="mes">Este mes</option><option value="semestre">Últimos 6 meses</option></select></label>
        </div>
        {history.status === 'loading' ? <DataFeedback status="loading" title="Consultando evolución" /> : history.status === 'error'
          ? <DataFeedback status="error" description={history.error ?? undefined} onRetry={reload} /> : history.data && (
            <SalesHistoryChart points={history.data.tendencia} grouping={period === 'mes' ? 'dia' : 'mes'} />
          )}
        <Link to={salesLink} className="diza-dashboard-panel-action">Ver reporte de ventas <span aria-hidden="true">→</span></Link>
      </section>
      <section className="diza-dashboard-panel" aria-labelledby="business-alerts-title">
        <div className="diza-dashboard-panel-heading"><h3 id="business-alerts-title">Requieren atención</h3><StatusBadge tone="warning">Inventario</StatusBadge></div>
        {alertsResource.status === 'loading' && <p role="status" className="diza-kpi-note">Consultando existencias, vencimientos y reposición…</p>}
        {alertsResource.status === 'error' && <div className="diza-dashboard-notice" role="status"><p>No se pudieron consultar las alertas operativas. Los demás avisos siguen disponibles.</p><Button variant="secondary" size="sm" onClick={reload}>Reintentar</Button></div>}
        <ul className="diza-business-alerts">{alerts.slice(0, 4).map(alert => <li key={alert.id}>
          <StatusBadge tone={alert.priority === 'critical' ? 'danger' : alert.priority === 'warning' ? 'warning' : 'info'}>{alert.priority === 'critical' ? 'Crítica' : alert.priority === 'warning' ? 'Advertencia' : 'Preventiva'}</StatusBadge>
          <strong>{alert.title}</strong><p>{alert.message}</p>
        </li>)}</ul>
        {alertsResource.status === 'success' && alerts.length === 0 && <p className="diza-kpi-note">Sin alertas de stock ni vencimientos en los próximos 7 días.</p>}
        <Link to="/alertas" className="diza-dashboard-panel-action">Ver todas las alertas <span aria-hidden="true">→</span></Link>
      </section>
    </div>
    {history.data && <section className="diza-dashboard-panel diza-business-ranking" aria-labelledby="business-ranking-title">
      <div className="diza-dashboard-panel-heading"><div><h3 id="business-ranking-title">Productos con mayor importe vendido</h3><p>{period === 'mes' ? 'Este mes' : 'Últimos 6 meses'}</p></div></div>
      {!history.data.ranking.length ? <p className="diza-kpi-note">Todavía no hay ventas para este período.</p>
        : <ol>{history.data.ranking.map(item => <li key={item.sku}><Link to={`${salesLink}&sku=${encodeURIComponent(item.sku)}`}><span>{item.nombre}<small>{item.sku}</small></span><strong>{formatMoney(item.importe)}</strong></Link></li>)}</ol>}
    </section>}
  </section>;
}
