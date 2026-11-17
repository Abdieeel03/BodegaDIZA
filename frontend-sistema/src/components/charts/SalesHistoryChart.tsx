import { useId } from 'react';
import type { SalesGrouping, SalesOrigin, SalesPoint } from '../../services/salesReportService';
import { salesDateLabel } from '../../services/salesReportService';
import { formatMoney } from '../period/PeriodControls';
import './sales-history-chart.css';

/** Series separadas: una fecha ausente no se presenta como una venta de cero. */
export function SalesHistoryChart({ points, grouping = 'mes', origin = 'todos' }: {
  points: SalesPoint[]; grouping?: SalesGrouping; origin?: SalesOrigin;
}) {
  const titleId = useId();
  const sources = (['historico', 'operativo'] as const).filter(source => origin === 'todos' || origin === source);
  const maximum = Math.max(1, ...points.flatMap(point => sources.map(source => Number(point[source] ?? 0))));
  const label = { historico: 'Histórico', operativo: 'Operativo' };
  return <figure className="diza-sales-history" aria-labelledby={titleId}>
    <figcaption id={titleId} className="diza-sales-history-legend">
      {sources.map(source => <span key={source}><i className={`is-${source}`} aria-hidden="true" />{label[source]} (S/)</span>)}
    </figcaption>
    {!points.length ? <p className="diza-kpi-note">No hay registros para este período.</p> : <>
      <div className="diza-sales-history-scroll" role="region" aria-label="Evolución de ventas por período; desplazamiento horizontal" tabIndex={0}>
        <div className="diza-sales-history-plot">
          {points.map(point => <div className="diza-sales-history-period" key={point.periodo}>
            <div className="diza-sales-history-bars">
              {sources.map(source => <div className="diza-sales-history-series" key={source}>
                <span className="diza-sales-history-amount">{point[source] === null ? '—' : formatMoney(point[source])}</span>
                <div className="diza-sales-history-track"><span className={`is-${source}`}
                  style={{ height: `${Number(point[source] ?? 0) / maximum * 100}%` }} /></div>
              </div>)}
            </div>
            <span className="diza-sales-history-date">{grouping === 'semana' ? 'Semana del ' : ''}{salesDateLabel(point.periodo, grouping)}</span>
          </div>)}
        </div>
      </div>
      <p className="diza-kpi-note">Se muestran períodos con registros. «—» indica ausencia de registros en ese origen; no confirma ventas cero.</p>
    </>}
  </figure>;
}
