import type { ChangeEvent } from 'react';
import './period-controls.css';

export type PeriodMode = 'dia' | 'semana' | 'mes' | 'anio' | 'todo';
export const todayLocal = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};
const iso = (d: Date) => d.toISOString().slice(0,10);
const parse = (s: string) => new Date(`${s}T12:00:00Z`);
export function getPeriodRange(mode: PeriodMode, anchor: string): {desde?: string; hasta?: string} {
  if (mode === 'todo') return {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return {};
  const d = parse(anchor);
  if (Number.isNaN(d.getTime())) return {};
  switch (mode) {
    case 'dia': return {desde: anchor, hasta: anchor};
    case 'semana': {
      const start = new Date(d);
      start.setUTCDate(d.getUTCDate() - ((d.getUTCDay()+6)%7));
      const end = new Date(start); end.setUTCDate(start.getUTCDate()+6);
      return {desde:iso(start),hasta:iso(end)};
    }
    case 'mes': {
      const start = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1,12));
      const end = new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12));
      return {desde:iso(start),hasta:iso(end)};
    }
    case 'anio': return {desde:`${d.getUTCFullYear()}-01-01`, hasta:`${d.getUTCFullYear()}-12-31`};
  }
}
export function dateInRange(date: string, range: {desde?: string;hasta?: string}): boolean {
  const d = date.slice(0,10);
  return (!range.desde || d >= range.desde) && (!range.hasta || d <= range.hasta);
}
export const formatMoney = (n: number) => `S/ ${Number(n || 0).toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
export const formatNumber = (n: number) => Number(n || 0).toLocaleString('es-PE', {maximumFractionDigits:2});
export const rangeLabel = (mode: PeriodMode, anchor: string) => {
  if (mode === 'todo') return 'Todo el período registrado';
  const {desde,hasta} = getPeriodRange(mode,anchor);
  return desde === hasta ? `Fecha: ${desde}` : `Del ${desde} al ${hasta}`;
};

export function PeriodControls({mode,setMode,anchor,setAnchor}: {
  mode: PeriodMode; setMode: (p: PeriodMode)=>void;
  anchor: string; setAnchor: (v:string)=>void;
}) {
  const handleMode = (e: ChangeEvent<HTMLSelectElement>) => setMode(e.target.value as PeriodMode);
  return <div className="diza-period" aria-label="Filtros por período">
    <label>Ver por
      <select value={mode} onChange={handleMode}>
        <option value="dia">Día</option>
        <option value="semana">Semana</option>
        <option value="mes">Mes</option>
        <option value="anio">Año</option>
        <option value="todo">Todo</option>
      </select>
    </label>
    {mode !== 'todo' && <label>Fecha de referencia
      <input type="date" value={anchor} onChange={e=>setAnchor(e.target.value)} />
    </label>}
    <span className="diza-period-range">{rangeLabel(mode,anchor)}</span>
  </div>;
}

export function MiniBars({data}:{data:{periodo:string;ingresos:number}[]}) {
  const recent = data.slice(-14);
  const max = Math.max(...recent.map(x=>Number(x.ingresos)), 1);
  if (!recent.length) return <p className="diza-period-empty">No hay movimientos en este período.</p>;
  return <div className="diza-mini-chart" role="img" aria-label="Ingresos agrupados por período">
    {recent.map(x=><div className="diza-mini-col" key={x.periodo} title={`${x.periodo}: ${formatMoney(x.ingresos)}`}>
      <strong>{formatMoney(x.ingresos)}</strong>
      <div className="diza-mini-track"><i style={{height:`${Math.max(3,Number(x.ingresos)/max*100)}%`}} /></div>
      <small>{x.periodo.slice(5)}</small>
    </div>)}
  </div>;
}
