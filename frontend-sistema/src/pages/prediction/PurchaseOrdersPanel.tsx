import { useEffect, useState, type FormEvent } from 'react';
import apiClient from '../../api/axios';
import type { ApiResponse, ReplenishmentOptimizationResult } from '../../types';
import { formatSoles } from '../../services/mlRevenue';
import { StatusBadge } from '../../components/ui';

type Detail = { id: number; productoId: number; productoNombre: string; productoSku: string; loteId: number | null; codigoLote: string | null; cantidad: number; costoUnitario: number; subtotal: number };
type Order = { id: number; proveedorNombre: string; fecha: string; fechaRecepcion: string | null; estado: 'PENDIENTE' | 'RECIBIDA' | 'CANCELADA'; total: number; usuarioPedido: string | null; detalles: Detail[] };
type Precision = 'EXACTA' | 'MES_ANIO' | 'PENDIENTE' | 'NO_APLICA';
type LotDraft = { productoId: number; codigoLote: string; cantidad: string; precision: Precision; fecha: string; mes: string };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.';
const cents = (value: number) => Math.round(value * 100);
const dateTime = (value: string) => new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
const newLot = (productoId: number, cantidad = ''): LotDraft => ({ productoId, codigoLote: '', cantidad, precision: 'EXACTA', fecha: '', mes: '' });
const unwrap = <T,>(body: ApiResponse<T>): T => {
  if (!body.success || body.data == null) throw new Error(body.message || 'La API no devolvió los datos esperados.');
  return body.data;
};
const inputStyle = { width: '100%', minWidth: 0, padding: '7px 9px', border: '1px solid #d4deec', borderRadius: 6 };

export function PurchaseOrdersPanel({ plan, onChange }: { plan: ReplenishmentOptimizationResult | null; onChange: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [review, setReview] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('PENDIENTE');
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const [lots, setLots] = useState<LotDraft[]>([]);

  const reload = async () => {
    setLoaded(false);
    try {
      const response = await apiClient.get<ApiResponse<Order[]>>('/compras');
      setOrders(unwrap(response.data));
      setLoaded(true);
    } catch (err) { setError(errorText(err)); }
  };
  useEffect(() => { void reload(); }, []);
  useEffect(() => {
    setReview(false);
    setQuantities(Object.fromEntries((plan?.items ?? []).map(item => [item.productId, String(item.allocatedUnits)])));
  }, [plan]);

  const pendingSkus = new Set(orders.filter(order => order.estado === 'PENDIENTE').flatMap(order => order.detalles.map(detail => detail.productoSku)));
  const selectable = (plan?.items ?? []).filter(item => !pendingSkus.has(item.productId));
  const lines = selectable.map(item => ({ item, quantity: Number(quantities[item.productId] ?? 0) }));
  const totalCents = lines.reduce((sum, line) => sum + line.quantity * cents(line.item.unitCost), 0);
  const validQuantities = lines.every(({ item, quantity }) => Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= item.recommendedReplenishment);
  const validPlan = loaded && !!plan && validQuantities && Number.isSafeInteger(totalCents) && totalCents > 0 && totalCents <= cents(plan.budget);
  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    if (!validPlan || busy || !plan) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await apiClient.post<ApiResponse<Order[]>>('/compras/pedidos', {
        presupuesto: plan.budget,
        items: lines.filter(line => line.quantity > 0).map(({ item, quantity }) => ({ sku: item.productId, proveedor: item.supplier, cantidad: quantity, costoUnitario: item.unitCost })),
      });
      const created = unwrap(response.data);
      setReview(false); setStatus('PENDIENTE');
      setMessage(`Se confirmaron ${created.length} pedidos. El stock no se ha modificado.`);
      onChange(); await reload();
    } catch (err) { setError(errorText(err) + ' Consulta los pedidos antes de repetir la confirmación.'); await reload(); }
    finally { setBusy(false); }
  };
  const openReceipt = (order: Order) => {
    setReceiptId(order.id); setLots(order.detalles.map(d => newLot(d.productoId, String(d.cantidad)))); setError(''); setMessage('');
  };
  const updateLot = (index: number, change: Partial<LotDraft>) => setLots(previous => previous.map((lot, i) => i === index ? { ...lot, ...change } : lot));
  const cancel = async (order: Order) => {
    if (busy || !window.confirm(`¿Cancelar el pedido #${order.id}? No se modificará el inventario.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      unwrap((await apiClient.post<ApiResponse<Order>>(`/compras/${order.id}/cancelar`)).data);
      if (receiptId === order.id) setReceiptId(null);
      setMessage(`Pedido #${order.id} cancelado.`); onChange(); await reload();
    } catch (err) { setError(errorText(err)); await reload(); }
    finally { setBusy(false); }
  };
  const current = orders.find(order => order.id === receiptId && order.estado === 'PENDIENTE');
  const receiptValid = !!current && lots.every(lot => lot.codigoLote.trim() && Number.isSafeInteger(Number(lot.cantidad)) && Number(lot.cantidad) > 0 &&
    (lot.precision !== 'EXACTA' || !!lot.fecha) && (lot.precision !== 'MES_ANIO' || !!lot.mes)) &&
    new Set(lots.map(lot => `${lot.productoId}:${lot.codigoLote.trim()}`)).size === lots.length &&
    current.detalles.every(detail => lots.filter(lot => lot.productoId === detail.productoId).reduce((sum, lot) => sum + Number(lot.cantidad), 0) === detail.cantidad);
  const receive = async (event: FormEvent) => {
    event.preventDefault();
    if (!current || !receiptValid || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      unwrap((await apiClient.post<ApiResponse<Order>>(`/compras/${current.id}/recibir`, {
        lotes: lots.map(lot => ({ productoId: lot.productoId, codigoLote: lot.codigoLote.trim(), cantidad: Number(lot.cantidad), vencimiento: {
          precision: lot.precision, fecha: lot.precision === 'EXACTA' ? lot.fecha : null, mes: lot.precision === 'MES_ANIO' ? lot.mes : null,
        } })),
      })).data);
      setMessage(`Pedido #${current.id} recibido. Inventario y movimientos actualizados.`);
      setReceiptId(null); setStatus('RECIBIDA'); onChange(); await reload();
    } catch (err) { setError(errorText(err) + ' Comprueba el estado del pedido antes de repetir.'); await reload(); }
    finally { setBusy(false); }
  };

  return <section id="diza-purchase-orders" className="diza-ml-card diza-purchase-orders">
    <div className="diza-ml-card-heading"><div><h2>Pedidos de compra</h2><p>Confirma las cantidades, recibe los lotes y consulta las compras registradas.</p></div>
      <button type="button" className="diza-ml-button" disabled={busy} onClick={() => { setError(''); void reload(); }}>Consultar pedidos</button></div>
    {error && <div className="diza-ml-error" role="alert">{error}</div>}
    {message && <p role="status"><strong>{message}</strong></p>}
    {!loaded && <p role="status">Consulta los pedidos para poder confirmar una propuesta.</p>}
    {plan && loaded && <div style={{ marginBottom: 16 }}>
      <button type="button" className="diza-ml-button" disabled={busy || !selectable.length} onClick={() => setReview(value => !value)}>{review ? 'Cerrar revisión' : 'Revisar propuesta de compra'}</button>
      {plan.items.some(item => pendingSkus.has(item.productId)) && <p>Los productos con un pedido pendiente se excluyen de esta confirmación. Recibe o cancela sus pedidos antes de volver a comprarlos.</p>}
      {review && <form onSubmit={confirm} className="diza-purchase-review">
        <p>Las cantidades se pueden ajustar hasta la necesidad sugerida. Los costos se validan nuevamente al confirmar.</p>
        <div className="diza-ml-table-scroll"><table><thead><tr><th>Producto</th><th>Proveedor</th><th>Máximo</th><th>Cantidad a comprar</th><th>Costo unit.</th><th>Subtotal</th></tr></thead><tbody>
          {lines.map(({ item, quantity }) => <tr key={item.productId}><td>{item.productName}</td><td>{item.supplier}</td><td>{item.recommendedReplenishment}</td>
            <td><input aria-label={`Cantidad ${item.productName}`} type="number" min="0" max={item.recommendedReplenishment} step="1" value={quantities[item.productId] ?? '0'} disabled={busy} required style={{ ...inputStyle, maxWidth: 110 }} onChange={e => setQuantities(previous => ({ ...previous, [item.productId]: e.target.value }))}/></td>
            <td>{formatSoles(item.unitCost)}</td><td>{formatSoles(quantity * cents(item.unitCost) / 100)}</td></tr>)}
        </tbody></table></div>
        <div className="diza-review-totals"><div><small>Total revisado</small><strong>{formatSoles(totalCents / 100)}</strong></div><div><small>Presupuesto</small><strong>{formatSoles(plan.budget)}</strong></div><div><small>Saldo</small><strong className={totalCents > cents(plan.budget) ? 'diza-plan-unmet' : ''}>{formatSoles((cents(plan.budget) - totalCents) / 100)}</strong></div></div>
        {!validPlan && <p role="status">Selecciona cantidades válidas y respeta el presupuesto.</p>}
        <button type="submit" className="diza-ml-button" disabled={!validPlan || busy}>{busy ? 'Procesando...' : 'Confirmar pedidos'}</button>
        <p><small>Se creará un pedido pendiente por proveedor. No se actualizará el stock hasta recibirlo.</small></p>
      </form>}
    </div>}
    <div className="diza-orders-heading"><h3>Historial de pedidos</h3><label>Estado de pedidos <select aria-label="Estado de pedidos" value={status} onChange={event => setStatus(event.target.value)} style={{ ...inputStyle, width: 'auto' }}><option value="PENDIENTE">Pendientes</option><option value="RECIBIDA">Recibidos</option><option value="CANCELADA">Cancelados</option><option value="TODOS">Todos</option></select></label></div>
    {loaded && !orders.some(order => status === 'TODOS' || order.estado === status) && <p>No hay pedidos con este estado.</p>}
    {loaded && orders.filter(order => status === 'TODOS' || order.estado === status).map(order => <details key={order.id} open={receiptId === order.id ? true : undefined} className="diza-order-detail">
      <summary><span className="diza-order-summary"><strong>#{order.id} · {order.proveedorNombre}</strong><span>{dateTime(order.fecha)}</span><strong>{formatSoles(order.total)}</strong><StatusBadge tone={order.estado === 'RECIBIDA' ? 'success' : order.estado === 'PENDIENTE' ? 'warning' : 'neutral'}>{order.estado === 'RECIBIDA' ? 'Recibido' : order.estado === 'PENDIENTE' ? 'Pendiente' : 'Cancelado'}</StatusBadge></span></summary>
      {order.usuarioPedido && <p>Confirmado por: {order.usuarioPedido}{order.fechaRecepcion ? ` · Recibido: ${dateTime(order.fechaRecepcion)}` : ''}</p>}
      <div className="diza-ml-table-scroll"><table><thead><tr><th>Producto</th><th>Cantidad</th><th>Costo unit.</th><th>Subtotal</th><th>Lote</th></tr></thead><tbody>
        {order.detalles.map(detail => <tr key={detail.id}><td>{detail.productoNombre}</td><td>{detail.cantidad}</td><td>{formatSoles(detail.costoUnitario)}</td><td>{formatSoles(detail.subtotal)}</td><td>{detail.codigoLote || '—'}</td></tr>)}
      </tbody></table></div>
      {order.estado === 'PENDIENTE' && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <button type="button" className="diza-ml-button" disabled={busy} onClick={() => openReceipt(order)}>Recibir mercadería</button>
        <button type="button" className="diza-ml-link" disabled={busy} onClick={() => void cancel(order)}>Cancelar pedido</button>
      </div>}
      {current?.id === order.id && <form onSubmit={receive} className="diza-receipt-form">
        <h3>Recepción del pedido #{order.id}</h3><p>Registra los lotes reales. Puedes dividir las unidades en varios lotes; la suma debe coincidir con el pedido.</p>
        {current.detalles.map(detail => <div key={detail.productoId} className="diza-receipt-product">
          <strong>{detail.productoNombre} · {detail.cantidad} unidades</strong>
          {lots.map((lot, index) => lot.productoId === detail.productoId && <div key={index} className="diza-receipt-lot">
            <label>Código de lote<input style={inputStyle} maxLength={100} required value={lot.codigoLote} onChange={e => updateLot(index, { codigoLote: e.target.value })} disabled={busy}/></label>
            <label>Cantidad<input style={inputStyle} type="number" required min={1} max={detail.cantidad} step={1} value={lot.cantidad} onChange={e => updateLot(index, { cantidad: e.target.value })} disabled={busy}/></label>
            <label>Vencimiento<select style={inputStyle} value={lot.precision} onChange={e => updateLot(index, { precision: e.target.value as Precision, fecha: '', mes: '' })} disabled={busy}>
              <option value="EXACTA">Fecha exacta</option><option value="MES_ANIO">Mes y año</option><option value="PENDIENTE">Pendiente de verificar</option><option value="NO_APLICA">No aplica (si autorizado)</option>
            </select></label>
            {lot.precision === 'EXACTA' && <label>Fecha<input style={inputStyle} type="date" required value={lot.fecha} onChange={e => updateLot(index, { fecha: e.target.value })} disabled={busy}/></label>}
            {lot.precision === 'MES_ANIO' && <label>Mes y año<input style={inputStyle} type="month" required value={lot.mes} onChange={e => updateLot(index, { mes: e.target.value })} disabled={busy}/></label>}
            <button type="button" className="diza-ml-link" disabled={busy || lots.filter(l => l.productoId === detail.productoId).length <= 1} onClick={() => setLots(previous => previous.filter((_, i) => i !== index))}>Quitar lote</button>
          </div>)}
          <button type="button" className="diza-ml-link" disabled={busy} onClick={() => setLots(previous => [...previous, newLot(detail.productoId)])}>+ Agregar lote</button>
          <p><small>Unidades indicadas: {lots.filter(l => l.productoId === detail.productoId).reduce((sum, l) => sum + Number(l.cantidad), 0)} / {detail.cantidad}</small></p>
        </div>)}
        <p>Los costos confirmados se conservan. Los lotes pendientes o de fecha ambigua quedan fuera del stock vendible según las reglas vigentes.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="submit" className="diza-ml-button" disabled={!receiptValid || busy}>Confirmar recepción</button><button type="button" className="diza-ml-link" disabled={busy} onClick={() => setReceiptId(null)}>Cerrar recepción</button></div>
      </form>}
    </details>)}
  </section>;
}
