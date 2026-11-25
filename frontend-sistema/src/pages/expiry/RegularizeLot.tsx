import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import apiClient from '../../api/axios';
import type { ApiResponse } from '../../types';
import type { ExpiringLot } from '../../services/dashboardService';
import { Button, FormField } from '../../components/ui';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { VencimientoFields, type Vencimiento } from './VencimientoFields';
import '../product/product-create.css';

type Audit = { id: number; fecha: string; usuario: string; accion: string; cantidad: number; antes: string; despues: string; motivo: string };
function unwrap<T>(body: ApiResponse<T>): T {
  if (!body.success || body.data === null) throw Error(body.message || 'No se pudo completar la operación');
  return body.data;
}

export function RegularizeLot({ lot, onClose, onSaved }: { lot: ExpiringLot; onClose: () => void; onSaved: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const [quantity, setQuantity] = useState(String(lot.cantidadDisponible));
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [policyReason, setPolicyReason] = useState('');
  const [policyConfirmed, setPolicyConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expiry, setExpiry] = useState<Vencimiento>({ precision: lot.precisionVencimiento, fecha: lot.fechaVencimiento, mes: lot.mesVencimiento });
  const split = Number(quantity) < lot.cantidadDisponible;
  const loadHistory = useCallback(async () => unwrap((await apiClient.get<ApiResponse<Audit[]>>('/inventario/regularizaciones', { params: { loteId: lot.id } })).data), [lot.id]);
  const history = useRemoteResource(loadHistory, true);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try {
      unwrap((await apiClient.post<ApiResponse<ExpiringLot[]>>('/inventario/regularizaciones', {
        loteId: lot.id, version: lot.version, cantidad: Number(quantity), nuevoCodigoLote: split ? code.trim() : null,
        vencimiento: expiry, motivo: reason.trim(),
      })).data);
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo regularizar'); }
    finally { setSaving(false); }
  }

  async function savePolicy(event: FormEvent) {
    event.preventDefault();
    if (saving || !policyConfirmed) return;
    setSaving(true); setError('');
    try {
      unwrap((await apiClient.post<ApiResponse<string>>('/inventario/politica-vencimiento', {
        productoId: lot.productoId, permiteSinVencimiento: !lot.permiteSinVencimiento, motivo: policyReason.trim(),
      })).data);
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar la política'); }
    finally { setSaving(false); }
  }

  return <section className="diza-expiry-regularize" aria-labelledby="regularize-title">
    <h2 id="regularize-title" tabIndex={-1} ref={heading}>Regularizar lote {lot.codigoLote}</h2>
    <p>{lot.productoNombre} · {lot.productoSku} · Stock físico: <strong>{lot.cantidadDisponible}</strong></p>
    {lot.advertencia && <p role="note">{lot.advertencia}</p>}
    {error && <p role="alert" className="diza-test-error">{error}</p>}
    <form onSubmit={e => { void save(e); }}>
      <fieldset disabled={saving} className="diza-create-grid">
        <FormField controlId="regularize-quantity" label="Cantidad a regularizar" required hint="Indica una cantidad menor para dividir el lote.">
          <input id="regularize-quantity" type="number" required min="0.001" max={lot.cantidadDisponible} step="0.001" value={quantity} onChange={e => setQuantity(e.target.value)} />
        </FormField>
        {split && <FormField controlId="regularize-code" label="Código del nuevo lote" required>
          <input id="regularize-code" required maxLength={100} value={code} onChange={e => setCode(e.target.value)} />
        </FormField>}
        <VencimientoFields prefix="regularize" value={expiry} onChange={setExpiry} allowsNone={lot.permiteSinVencimiento} />
        <FormField controlId="regularize-reason" label="Motivo y evidencia de la corrección" required>
          <textarea id="regularize-reason" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ej.: fecha verificada en etiqueta del fabricante" />
        </FormField>
      </fieldset>
      <p>{split ? `Quedarán ${Number((lot.cantidadDisponible - Number(quantity)).toFixed(3))} en el lote original y ${quantity} en el nuevo.` : 'Se corregirá la fecha de todo el stock actual del lote.'} El stock físico total y los tickets históricos se conservan.</p>
      <div className="diza-create-actions"><Button variant="secondary" type="button" disabled={saving} onClick={onClose}>Cancelar</Button><Button type="submit" loading={saving}>Confirmar regularización</Button></div>
    </form>
    <details><summary>Política de vencimiento del producto</summary>
      <p>No aplica requiere evidencia de que este producto no necesita vencimiento. No debe utilizarse para evitar el control de alimentos o productos que sí lo requieren. La política afecta a todos sus lotes sin vencimiento.</p>
      <form onSubmit={e => { void savePolicy(e); }}>
        <FormField controlId="policy-reason" label="Justificación de la política" required><textarea id="policy-reason" required maxLength={500} value={policyReason} onChange={e => setPolicyReason(e.target.value)} /></FormField>
        <label className="diza-create-check"><input type="checkbox" checked={policyConfirmed} onChange={e => setPolicyConfirmed(e.target.checked)} required />{lot.permiteSinVencimiento ? 'Confirmo que este producto requiere vencimiento. Sus lotes No aplica quedarán bloqueados.' : 'Verifiqué que este producto no requiere vencimiento y justifico la excepción.'}</label>
        <Button type="submit" disabled={!policyConfirmed || saving}>{lot.permiteSinVencimiento ? 'Exigir vencimiento' : 'Autorizar No aplica'}</Button>
      </form>
    </details>
    <details><summary>Historial de regularización</summary>
      {history.status === 'loading' ? <p role="status">Cargando historial…</p> : history.status === 'error' ? <p role="alert">{history.error} <button onClick={history.reload}>Reintentar</button></p> : !history.data?.length ? <p>Sin regularizaciones registradas.</p> : <ul>{history.data.map(a => <li key={a.id}><strong>{a.accion} · {a.cantidad}</strong> · {new Date(a.fecha).toLocaleString('es-PE')} · {a.usuario}<p>{a.motivo}</p><p>Antes: {a.antes}</p><p>Después: {a.despues}</p></li>)}</ul>}
    </details>
  </section>;
}
