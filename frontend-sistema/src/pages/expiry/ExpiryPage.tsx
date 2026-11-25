import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { RegularizeLot } from './RegularizeLot';
import { Button, PageHeader, StatCard, StatusBadge, TableFrame, type StatusTone } from '../../components/ui';
import { DataFeedback } from '../../components/common/DataFeedback';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { getExpiryAlerts, type ExpiringLot } from '../../services/dashboardService';
import './expiry.css';

type ExpiryFilter = 'all' | ExpiringLot['estadoVencimiento'];

const dateLabel = (lot: ExpiringLot) => lot.fechaVencimiento
  ? new Date(`${lot.fechaVencimiento}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
  : lot.mesVencimiento ? `${lot.mesVencimiento.slice(5)}/${lot.mesVencimiento.slice(0, 4)} (mes/año)`
  : lot.precisionVencimiento === 'NO_APLICA' ? 'No aplica' : 'Por verificar';

const statuses: Record<ExpiringLot['estadoVencimiento'], { label: string; tone: StatusTone }> = {
  VENCIDO: { label: 'Vencido', tone: 'danger' }, HOY: { label: 'Vence hoy', tone: 'danger' },
  CRITICO: { label: 'Crítico · 1–3 días', tone: 'warning' }, PROXIMO: { label: 'Próximo · 4–7 días', tone: 'warning' },
  PREVENTIVO: { label: 'Preventivo · 8–30 días', tone: 'info' }, SEGUIMIENTO: { label: 'Seguimiento · más de 30 días', tone: 'info' },
  PENDIENTE: { label: 'Pendiente de verificación', tone: 'warning' }, NO_APLICA: { label: 'No aplica', tone: 'neutral' },
};
const expiryInfo = (lot: ExpiringLot) => ({ ...statuses[lot.estadoVencimiento], filter: lot.estadoVencimiento });

export function ExpiryPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [targetLot, setTargetLot] = useState(params.get('loteId') ?? '');
  const [horizon, setHorizon] = useState(params.has('loteId') ? 0 : 7);
  const [editing, setEditing] = useState<ExpiringLot | null>(null);
  const [success, setSuccess] = useState('');
  const loadLots = useCallback(() => getExpiryAlerts(0), []);
  const source = useRemoteResource(loadLots, true);
  const [search, setSearch] = useState(params.get('lote') ?? params.get('sku') ?? '');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<ExpiryFilter>('all');
  const lots = source.data ?? [];
  const categories = useMemo(() => [...new Set(lots.map(lot => lot.productoCategoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [lots]);
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-PE');
    return lots.filter(lot => {
      const matchesSearch = !term || `${lot.productoNombre} ${lot.productoSku} ${lot.productoCategoria} ${lot.codigoLote}`.toLocaleLowerCase('es-PE').includes(term);
      const matchesCategory = !category || lot.productoCategoria === category;
      const matchesStatus = status === 'all' || expiryInfo(lot).filter === status;
      return (!targetLot || String(lot.id) === targetLot) && matchesSearch && matchesCategory && matchesStatus && (horizon === 0 || lot.diasParaVencer === null || lot.diasParaVencer <= horizon);
    });
  }, [lots, search, category, status, horizon, targetLot]);
  const expired = lots.filter(lot => expiryInfo(lot).filter === 'VENCIDO').length;
  const immediate = lots.filter(lot => ['HOY', 'CRITICO'].includes(expiryInfo(lot).filter)).length;
  const week = lots.filter(lot => expiryInfo(lot).filter === 'PENDIENTE').length;
  const hasFilters = Boolean(targetLot || search || category || status !== 'all' || horizon !== 7);

  return <main className="diza-expiry-page">
    <PageHeader
      title="Próximos a vencer"
      description="Seguimiento del stock físico, incluso vencido o pendiente. Solo los lotes habilitados forman parte del stock vendible."
      actions={<Button variant="secondary" size="sm" loading={source.status === 'loading'} onClick={source.reload}>Recargar</Button>}
    />
    {success && <p role="status">{success}</p>}
    {editing && <RegularizeLot key={editing.id} lot={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setSuccess('Cambios registrados con trazabilidad. Stock actualizado.'); source.reload(); }} />}
    {source.status === 'loading'  ? <DataFeedback status="loading" title="Consultando lotes próximos a vencer" />
      : source.status === 'error' ? <DataFeedback status="error" title="No se pudieron consultar los vencimientos" description={source.error ?? undefined} onRetry={source.reload} />
        : <>
          <div className="diza-expiry-kpis">
            <StatCard label="Vencidos" value={expired} note="Requieren revisión inmediata" />
            <StatCard label="Próximos 3 días" value={immediate} note="Conviene priorizar su salida" />
            <StatCard label="Pendientes" value={week} note="Bloqueados hasta verificar su vencimiento" />
          </div>
          <section className="diza-expiry-panel" aria-labelledby="expiry-lots-title">
            <div className="diza-expiry-heading">
              <div><h2 id="expiry-lots-title">Lotes con stock físico</h2><p>{visible.length} {visible.length === 1 ? 'lote coincide' : 'lotes coinciden'} con los filtros.</p></div>
              <label className="diza-expiry-search">Buscar producto, SKU, categoría o lote
                <input type="search" value={search} onChange={event => { setSearch(event.target.value); setTargetLot(''); }} placeholder="Ej.: leche, P001 o L-001" />
              </label>
            </div>
            <div className="diza-expiry-filters" aria-label="Filtros de vencimiento">
              <label>Horizonte<select aria-label="Horizonte" value={horizon} onChange={event => setHorizon(Number(event.target.value))}>{[7, 15, 30, 90, 0].map(days => <option key={days} value={days}>{days === 0 ? 'Todos' : `${days} días`}</option>)}</select></label>
              <label>Categoría<select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Estado<select value={status} onChange={event => setStatus(event.target.value as ExpiryFilter)}><option value="all">Todos</option>{Object.entries(statuses).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}</select></label>
              {hasFilters && <button type="button" onClick={() => { setTargetLot(''); setSearch(''); setCategory(''); setStatus('all'); setHorizon(7); }}>Restablecer filtros</button>}
            </div>
            {!visible.length ? <DataFeedback status="empty" title={lots.length ? 'No hay lotes con esos filtros' : 'No hay lotes próximos a vencer'} description={lots.length ? 'Prueba con otra búsqueda, categoría o estado.' : 'No hay lotes con stock físico en este horizonte. Los vencidos y pendientes permanecen visibles.'} />
              : <>
                <TableFrame label="Lotes próximos a vencer" className="diza-expiry-table-frame"><table className="diza-expiry-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Lote</th><th>Stock físico / vendible</th><th>Vencimiento</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{visible.map(lot => { const info = expiryInfo(lot); return <tr key={lot.id}><td><strong>{lot.productoNombre}</strong><small>{lot.productoSku}</small></td><td>{lot.productoCategoria}</td><td>{lot.codigoLote}</td><td>{Number(lot.cantidadDisponible).toLocaleString('es-PE')} / {lot.vendible ? Number(lot.cantidadDisponible).toLocaleString('es-PE') : '0'}</td><td>{dateLabel(lot)}{lot.advertencia && <small className="diza-expiry-note">{lot.advertencia}</small>}</td><td><StatusBadge tone={info.tone}>{info.label}</StatusBadge></td><td>{user?.rol === 'ADMIN' && <Button size="sm" variant="secondary" onClick={() => { setEditing(lot); setSuccess(''); }}>Regularizar</Button>}</td></tr>; })}</tbody></table></TableFrame>
                <div className="diza-expiry-cards">{visible.map(lot => { const info = expiryInfo(lot); return <article key={lot.id}><div><StatusBadge tone={info.tone}>{info.label}</StatusBadge><span>{lot.productoCategoria}</span></div><h3>{lot.productoNombre}</h3><p>{lot.productoSku} · Lote {lot.codigoLote}</p><dl><div><dt>Stock físico / vendible</dt><dd>{Number(lot.cantidadDisponible).toLocaleString('es-PE')} / {lot.vendible ? lot.cantidadDisponible : 0}</dd></div><div><dt>Vencimiento</dt><dd>{dateLabel(lot)}</dd></div></dl>{lot.advertencia && <p className="diza-expiry-note">{lot.advertencia}</p>}{user?.rol === 'ADMIN' && <Button size="sm" variant="secondary" onClick={() => { setEditing(lot); setSuccess(''); }}>Regularizar</Button>}</article>; })}</div>
              </>}
          </section>
        </>}
  </main>;
}

export default ExpiryPage;
