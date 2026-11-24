import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, PageHeader, StatCard, StatusBadge, TableFrame, type StatusTone } from '../../components/ui';
import { DataFeedback } from '../../components/common/DataFeedback';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { getExpiryAlerts, type ExpiringLot } from '../../services/dashboardService';
import './expiry.css';

type ExpiryFilter = 'all' | 'expired' | 'today' | 'soon' | 'week';

const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('es-PE', {
  day: '2-digit', month: 'short', year: 'numeric',
});

const expiryInfo = (lot: ExpiringLot): { label: string; tone: StatusTone; filter: ExpiryFilter } => {
  if (lot.vencido) return { label: 'Vencido', tone: 'danger', filter: 'expired' };
  if (lot.diasParaVencer <= 0) return { label: 'Vence hoy', tone: 'danger', filter: 'today' };
  if (lot.diasParaVencer <= 3) return { label: `Vence en ${lot.diasParaVencer} días`, tone: 'warning', filter: 'soon' };
  return { label: `Vence en ${lot.diasParaVencer} días`, tone: 'info', filter: 'week' };
};

export function ExpiryPage() {
  const loadLots = useCallback(() => getExpiryAlerts(7), []);
  const source = useRemoteResource(loadLots, true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<ExpiryFilter>('all');
  const lots = source.data ?? [];
  const categories = useMemo(() => [...new Set(lots.map(lot => lot.productoCategoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [lots]);
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-PE');
    return lots.filter(lot => {
      const matchesSearch = !term || `${lot.productoNombre} ${lot.productoSku} ${lot.codigoLote}`.toLocaleLowerCase('es-PE').includes(term);
      const matchesCategory = !category || lot.productoCategoria === category;
      const matchesStatus = status === 'all' || expiryInfo(lot).filter === status;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [lots, search, category, status]);
  const expired = lots.filter(lot => expiryInfo(lot).filter === 'expired').length;
  const immediate = lots.filter(lot => ['today', 'soon'].includes(expiryInfo(lot).filter)).length;
  const week = lots.filter(lot => expiryInfo(lot).filter === 'week').length;
  const hasFilters = Boolean(search || category || status !== 'all');

  return <main className="diza-expiry-page">
    <PageHeader
      title="Próximos a vencer"
      description="Lotes disponibles con vencimiento dentro de los próximos 7 días."
      actions={<Button variant="secondary" size="sm" loading={source.status === 'loading'} onClick={source.reload}>Recargar</Button>}
    />
    {source.status === 'loading' ? <DataFeedback status="loading" title="Consultando lotes próximos a vencer" />
      : source.status === 'error' ? <DataFeedback status="error" title="No se pudieron consultar los vencimientos" description={source.error ?? undefined} onRetry={source.reload} />
        : <>
          <div className="diza-expiry-kpis">
            <StatCard label="Vencidos" value={expired} note="Requieren revisión inmediata" />
            <StatCard label="Próximos 3 días" value={immediate} note="Conviene priorizar su salida" />
            <StatCard label="Entre 4 y 7 días" value={week} note="Planifica su rotación" />
          </div>
          <section className="diza-expiry-panel" aria-labelledby="expiry-lots-title">
            <div className="diza-expiry-heading">
              <div><h2 id="expiry-lots-title">Lotes disponibles</h2><p>{visible.length} {visible.length === 1 ? 'lote coincide' : 'lotes coinciden'} con los filtros.</p></div>
              <label className="diza-expiry-search">Buscar lote, SKU o producto
                <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Ej.: leche, P001 o L-001" />
              </label>
            </div>
            <div className="diza-expiry-filters" aria-label="Filtros de vencimiento">
              <label>Categoría<select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Estado<select value={status} onChange={event => setStatus(event.target.value as ExpiryFilter)}><option value="all">Todos</option><option value="expired">Vencidos</option><option value="today">Vence hoy</option><option value="soon">Vence en 1 a 3 días</option><option value="week">Vence en 4 a 7 días</option></select></label>
              {hasFilters && <button type="button" onClick={() => { setSearch(''); setCategory(''); setStatus('all'); }}>Restablecer filtros</button>}
            </div>
            {!visible.length ? <DataFeedback status="empty" title={lots.length ? 'No hay lotes con esos filtros' : 'No hay lotes próximos a vencer'} description={lots.length ? 'Prueba con otra búsqueda, categoría o estado.' : 'No se detectaron lotes disponibles que venzan durante los próximos 7 días.'} />
              : <>
                <TableFrame label="Lotes próximos a vencer" className="diza-expiry-table-frame"><table className="diza-expiry-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Lote</th><th>Disponible</th><th>Vencimiento</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{visible.map(lot => { const info = expiryInfo(lot); return <tr key={lot.id}><td><strong>{lot.productoNombre}</strong><small>{lot.productoSku}</small></td><td>{lot.productoCategoria}</td><td>{lot.codigoLote}</td><td>{Number(lot.cantidadDisponible).toLocaleString('es-PE')}</td><td>{dateLabel(lot.fechaVencimiento)}</td><td><StatusBadge tone={info.tone}>{info.label}</StatusBadge></td><td><Link to="/inventario">Ver inventario</Link></td></tr>; })}</tbody></table></TableFrame>
                <div className="diza-expiry-cards">{visible.map(lot => { const info = expiryInfo(lot); return <article key={lot.id}><div><StatusBadge tone={info.tone}>{info.label}</StatusBadge><span>{lot.productoCategoria}</span></div><h3>{lot.productoNombre}</h3><p>{lot.productoSku} · Lote {lot.codigoLote}</p><dl><div><dt>Disponible</dt><dd>{Number(lot.cantidadDisponible).toLocaleString('es-PE')}</dd></div><div><dt>Vencimiento</dt><dd>{dateLabel(lot.fechaVencimiento)}</dd></div></dl><Link to="/inventario">Ver inventario</Link></article>; })}</div>
              </>}
          </section>
        </>}
  </main>;
}

export default ExpiryPage;
