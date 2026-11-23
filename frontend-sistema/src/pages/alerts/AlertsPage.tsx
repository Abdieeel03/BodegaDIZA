import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button, PageHeader, StatCard, StatusBadge } from '../../components/ui';
import { DataFeedback } from '../../components/common/DataFeedback';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { getOperationalAlerts } from '../../services/alertsService';
import './alerts.css';

const observedLabel = (value: string) => new Date(value).toLocaleString('es-PE', {
  timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric',
});

export function AlertsPage() {
  const loadAlerts = useCallback(() => getOperationalAlerts(), []);
  const source = useRemoteResource(loadAlerts, true);
  const alerts = source.data?.alerts ?? [];
  const urgent = alerts.filter(alert => alert.priority === 'urgent').length;

  return <main className="diza-alerts-page">
    <PageHeader title="Alertas" description="Avisos actuales de stock, vencimientos y reposición." actions={
      <Button variant="secondary" size="sm" loading={source.status === 'loading'} onClick={source.reload}>Recargar alertas</Button>
    } />
    {source.status === 'loading' ? <DataFeedback status="loading" title="Consultando alertas actuales" />
      : source.status === 'error' ? <DataFeedback status="error" title="No se pudieron consultar las alertas" description={source.error ?? undefined} onRetry={source.reload} />
        : <>
          <div className="diza-alerts-kpis">
            <StatCard label="Urgentes" value={urgent} note="Stock agotado, bajo mínimo o vencido" />
            <StatCard label="Por revisar" value={alerts.length - urgent} note="Vencen en 7 días o requieren reposición" />
            <StatCard label="Total actual" value={alerts.length} note={`Consultado: ${source.data ? observedLabel(source.data.observedAt) : '—'}`} />
          </div>
          <section className="diza-alerts-list" aria-label="Notificaciones operativas">
            <div className="diza-alerts-list-heading"><div><h2>Notificaciones actuales</h2><p>Se actualizan con las existencias y lotes disponibles; no son un historial guardado.</p></div></div>
            {!alerts.length ? <DataFeedback status="empty" title="No hay alertas activas" description="No se detectaron faltantes ni lotes próximos a vencer en los siguientes 7 días." />
              : <ul>{alerts.map(alert => <li key={alert.id} className={`diza-alert-item diza-alert-item--${alert.priority}`}>
                <StatusBadge tone={alert.priority === 'urgent' ? 'danger' : 'warning'}>{alert.priority === 'urgent' ? 'Urgente' : 'Revisar'}</StatusBadge>
                <div><strong>{alert.title}</strong><p>{alert.message}</p></div>
                <Link to={alert.actionUrl}>Ver detalle</Link>
              </li>)}</ul>}
          </section>
        </>}
  </main>;
}

export default AlertsPage;
