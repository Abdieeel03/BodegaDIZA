import { FormField } from '../../components/ui';

export type Precision = 'EXACTA' | 'MES_ANIO' | 'PENDIENTE' | 'NO_APLICA';
export type Vencimiento = { precision: Precision; fecha: string | null; mes: string | null };
export const pendingExpiry = (): Vencimiento => ({ precision: 'PENDIENTE', fecha: null, mes: null });

export function VencimientoFields({ value, onChange, prefix, allowsNone = false }: {
  value: Vencimiento; onChange: (value: Vencimiento) => void; prefix: string; allowsNone?: boolean;
}) {
  return <>
    <FormField controlId={`${prefix}-precision`} label="Tipo de vencimiento" required>
      <select id={`${prefix}-precision`} value={value.precision} onChange={e => onChange({ precision: e.target.value as Precision, fecha: null, mes: null })}>
        <option value="PENDIENTE">Pendiente de verificación</option>
        <option value="EXACTA">Fecha exacta confirmada</option>
        <option value="MES_ANIO">Mes y año de la etiqueta</option>
        <option value="NO_APLICA" disabled={!allowsNone}>No aplica (requiere política autorizada)</option>
      </select>
    </FormField>
    {value.precision === 'EXACTA' && <FormField controlId={`${prefix}-expiry`} label="Fecha de vencimiento" required>
      <input id={`${prefix}-expiry`} required type="date" value={value.fecha ?? ''} onChange={e => onChange({ ...value, fecha: e.target.value || null })} />
    </FormField>}
    {value.precision === 'MES_ANIO' && <FormField controlId={`${prefix}-month`} label="Mes y año" required hint="Se conserva sin inventar un día. No vendible hasta verificar un límite seguro.">
      <input id={`${prefix}-month`} required type="month" value={value.mes ?? ''} onChange={e => onChange({ ...value, mes: e.target.value || null })} />
    </FormField>}
    {value.precision === 'PENDIENTE' && <p className="diza-kpi-note">El lote se registra como stock físico y queda bloqueado para venta hasta su regularización.</p>}
  </>;
}
