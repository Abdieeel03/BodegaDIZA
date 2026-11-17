import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, PageHeader, StatCard, TableFrame } from '../../components/ui';
import { DataFeedback } from '../../components/common/DataFeedback';
import { SaleRegistrationForm } from './SaleRegistrationForm';
import { UnifiedSalesReport } from './UnifiedSalesReport';
import { productosOperativos, registrarVentaConItems, ventasOperativas,
  type ProductoOperativo, type SaleItemPayload, type VentaOperativa } from '../../services/testDataService';
import { formatMoney } from '../../components/period/PeriodControls';
import { peruToday } from '../../services/salesReportService';
import '../demo/demo.css';
import './unified-sales.css';

export const SalesPage = () => {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<ProductoOperativo[]>([]);
  const [sales, setSales] = useState<VentaOperativa[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saleError, setSaleError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [ticketQuery, setTicketQuery] = useState('');
  const [ticketPage, setTicketPage] = useState(0);
  const today = peruToday();
  const from = params.get('desde') ?? `${today.slice(0, 7)}-01`;
  const to = params.get('hasta') ?? today;
  const sku = params.get('sku') ?? '';
  const origin = params.get('origen') ?? 'todos';
  const validDates = !from || !to || from <= to;
  const registerOpen = params.get('registrar') === '1';
  const toggleRegister = () => {
    const next = new URLSearchParams(params);
    if (registerOpen) next.delete('registrar'); else next.set('registrar', '1');
    setParams(next, { replace: true });
  };
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const [catalog, tickets] = await Promise.all([productosOperativos(), ventasOperativas({ desde: from || undefined, hasta: to || undefined }, signal)]);
    if (signal?.aborted) return;
    setProducts(catalog); setSales(tickets);
  }, [from, to]);
  useEffect(() => {
    if (!validDates) return;
    const controller = new AbortController();
    setLoading(true); setLoadError(''); setSales([]);
    void refresh(controller.signal).catch(error => {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'No se pudieron consultar las ventas.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh, revision, validDates]);

  const registerSale = async (items: SaleItemPayload[]): Promise<boolean> => {
    if (busy || !items.length) return false;
    setBusy(true); setSaleError(''); setMessage('');
    try {
      const sale = await registrarVentaConItems(items);
      setMessage(`Venta #${sale.id} registrada correctamente. El inventario se actualizó. Si no aparece en el reporte, selecciona un período que incluya hoy.`);
      setTicketPage(0); setTicketQuery(''); setRevision(value => value + 1);
      return true;
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : 'No se pudo registrar la venta.');
      return false;
    } finally { setBusy(false); }
  };
  const tickets = useMemo(() => sales.filter(sale =>
    (!from || sale.fecha.slice(0, 10) >= from) && (!to || sale.fecha.slice(0, 10) <= to)
    && (!sku || sale.detalles?.some(detail => detail.productoSku === sku))
    && (!ticketQuery.trim() || String(sale.id).includes(ticketQuery.trim().replace(/^#/, ''))))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id), [sales, from, to, sku, ticketQuery]);
  const page = Math.min(ticketPage, Math.max(0, Math.ceil(tickets.length / 20) - 1));

  return <section className="diza-test-page">
    <PageHeader title="Ventas" description="Consulta el histórico y las ventas de tu bodega en un solo lugar."
      actions={<div className="diza-sales-actions">
        <Link to="/ventas/importar-historico" className="diza-period-link">Importar histórico</Link>
        <Button variant="secondary" onClick={() => setRevision(value => value + 1)} disabled={loading || busy}>Actualizar datos</Button>
        <Button onClick={toggleRegister} aria-expanded={registerOpen} aria-controls="sale-registration">{registerOpen ? 'Cerrar formulario' : 'Registrar venta'}</Button>
      </div>} />
    {registerOpen && <section id="sale-registration" className="diza-test-panel diza-sales-registration" aria-label="Registrar venta">
      <h2>Registrar venta</h2><p className="diza-kpi-note">El sistema verifica las existencias antes de registrar la venta.</p>
      <SaleRegistrationForm products={products} busy={busy} loading={loading || Boolean(loadError)} onRegister={registerSale} />
      {saleError && <p className="diza-test-error" role="alert">{saleError}</p>}
      {loadError && <DataFeedback status="error" description={loadError} onRetry={() => setRevision(value => value + 1)} />}
    </section>}
    {message && <p className="diza-test-success" role="status">{message}</p>}
    <UnifiedSalesReport revision={revision} />
    {origin !== 'historico' && validDates && <details className="diza-test-panel diza-sales-registration">
      <summary>Consultar tickets operativos</summary>
      <p className="diza-kpi-note">Se aplican las fechas y el producto del reporte. El importe del ticket incluye todos sus productos. Buscar un ticket no cambia el gráfico.</p>
      <label className="diza-sale-search" htmlFor="sale-ticket-search">Buscar número de ticket
        <input id="sale-ticket-search" type="search" placeholder="Ej. 125" value={ticketQuery} onChange={event => { setTicketQuery(event.target.value); setTicketPage(0); }} />
      </label>
      {loading ? <DataFeedback status="loading" title="Consultando tickets" /> : loadError
        ? <DataFeedback status="error" description={loadError} onRetry={() => setRevision(value => value + 1)} />
        : <><div className="diza-stat-grid">
          <StatCard label="Tickets encontrados" value={tickets.length} />
          <StatCard label="Importe promedio por ticket" value={tickets.length ? formatMoney(tickets.reduce((sum, sale) => sum + Number(sale.total), 0) / tickets.length) : '—'} note="Incluye todos los productos de los tickets encontrados" />
        </div><TableFrame label="Tickets operativos del período"><table className="diza-test-table">
          <thead><tr><th scope="col">Ticket</th><th scope="col">Fecha</th><th scope="col">Total del ticket</th><th scope="col">Detalle</th></tr></thead>
          <tbody>{tickets.slice(page * 20, (page + 1) * 20).map(sale => <tr key={sale.id}>
            <td>#{sale.id}</td><td>{sale.fecha.replace('T', ' ')}</td><td>{formatMoney(sale.total)}</td>
            <td><details><summary>Ver productos</summary><ul>{sale.detalles?.map(detail => <li key={detail.id}>{detail.productoNombre}: {Number(detail.cantidad).toLocaleString('es-PE')} · {formatMoney(detail.subtotal)}</li>)}</ul></details></td>
          </tr>)}</tbody>
        </table></TableFrame>
        {!tickets.length && <p role="status" className="diza-kpi-note">No hay tickets que coincidan con la búsqueda.</p>}
        <nav className="diza-sales-pagination" aria-label="Paginación de tickets"><span>{tickets.length} tickets · Página {page + 1} de {Math.max(1, Math.ceil(tickets.length / 20))}</span>
          <div><Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setTicketPage(page - 1)}>Anterior</Button>
            <Button variant="secondary" size="sm" disabled={(page + 1) * 20 >= tickets.length} onClick={() => setTicketPage(page + 1)}>Siguiente</Button></div>
        </nav></>}
    </details>}
  </section>;
};
export default SalesPage;
