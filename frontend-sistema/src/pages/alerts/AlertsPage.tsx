import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, PageHeader, StatCard, StatusBadge, type StatusTone } from '../../components/ui';
import { DataFeedback } from '../../components/common/DataFeedback';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { getOperationalAlerts, type AlertPriority, type AlertKind } from '../../services/alertsService';
import './alerts.css';

const priorities: Record<AlertPriority, { label: string; tone: StatusTone }> = {
  critical: { label: 'Crítica', tone: 'danger' }, warning: { label: 'Advertencia', tone: 'warning' }, preventive: { label: 'Preventiva', tone: 'info' },
};
const kinds: Record<AlertKind, string> = { stock: 'Stock', expiry: 'Vencimientos', pending: 'Fechas pendientes', prediction: 'Predicción' };
const observedLabel = (value: string) => new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function AlertsPage() {
  const loadAlerts = useCallback(() => getOperationalAlerts(), []);
  const source = useRemoteResource(loadAlerts, true);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState<AlertPriority | 'all'>('all');
  const [kind, setKind] = useState<AlertKind | 'all'>('all');
  const reload = source.reload;
  useEffect(() => {
    // Las rutas se vuelven a consultar al entrar. Refrescar también si otra pestaña modificó stock.
    const refresh = () => { if (document.visibilityState === 'visible') reload(); };
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(interval); };
  }, [reload]);
  const alerts = useMemo(() => source.data?.alerts ?? [], [source.data]);
  const visible = useMemo(() => alerts.filter(alert => (priority === 'all' || priority === alert.priority) && (kind === 'all' || kind === alert.kind)
    && fold(`${alert.title} ${alert.sku} ${alert.message}`).includes(fold(search.trim()))), [alerts, priority, kind, search]);
  const count = (p: AlertPriority) => alerts.filter(alert => alert.priority === p).length;
  const clear = () => { setSearch(''); setPriority('all'); setKind('all'); };

  return <main className="diza-alerts-page">
    <PageHeader title="Alertas" description="Identifica y atiende las incidencias de tu negocio." actions={
      <Button variant="secondary" size="sm" loading={source.status === 'loading'} onClick={reload}>Recargar alertas</Button>
    } />
    {source.status === 'loading' ? <DataFeedback status="loading" title="Consultando alertas actuales" />
      : source.status === 'error' ? <DataFeedback status="error" title="No se pudieron consultar las alertas" description={source.error ?? undefined} onRetry={reload} />
        : <>
          <div className="diza-alerts-kpis">
            <StatCard label="Críticas" value={count('critical')} note="Agotados, vencidos y próximos 3 días" />
            <StatCard label="Advertencias" value={count('warning')} note="Stock bajo, fechas pendientes y riesgo" />
            <StatCard label="Preventivas" value={count('preventive')} note="Vencimientos y reposición anticipada" />
          </div>
          {source.data?.predictionAvailability !== 'available' && <p className="diza-alerts-notice" role="status">{source.data?.predictionAvailability === 'outdated' ? 'El horizonte predictivo no está vigente.' : 'Predicción no disponible en este momento.'} Las alertas de inventario siguen activas. <Link to="/prediccion-demanda">Consultar predicción</Link></p>}
          <section className="diza-alerts-list" aria-label="Notificaciones operativas">
            <div className="diza-alerts-list-heading"><div><h2>Alertas actuales</h2><p>{visible.length} de {alerts.length} alertas · {source.data ? `Actualizado: ${observedLabel(source.data.observedAt)}` : '—'}</p></div></div>
            <div className="diza-alerts-filters">
              <label>Buscar producto, SKU o lote<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ej.: leche, P001" /></label>
              <label>Prioridad<select value={priority} onChange={e => setPriority(e.target.value as AlertPriority | 'all')}><option value="all">Todas</option>{Object.entries(priorities).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
              <label>Tipo<select value={kind} onChange={e => setKind(e.target.value as AlertKind | 'all')}><option value="all">Todos</option>{Object.entries(kinds).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
              {(search || priority !== 'all' || kind !== 'all') && <Button variant="secondary" size="sm" onClick={clear}>Limpiar filtros</Button>}
            </div>
            {!visible.length ? <DataFeedback status="empty" title={alerts.length ? 'No hay alertas con esos filtros' : 'No hay alertas activas'} description={alerts.length ? 'Prueba otra búsqueda o cambia los filtros.' : 'No se detectaron incidencias en las fuentes disponibles.'} />
              : <ul>{visible.map(alert => <li key={alert.id} className={`diza-alert-item diza-alert-item--${alert.priority}`}>
                <StatusBadge tone={priorities[alert.priority].tone}>{priorities[alert.priority].label}</StatusBadge>
                <div><strong>{alert.title}</strong><p>{alert.sku} · {alert.message}</p></div>
                <Link to={alert.actionUrl}>{alert.actionLabel}</Link>
              </li>)}</ul>}
          </section>
        </>}
  </main>;
}
export default AlertsPage;
