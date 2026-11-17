import { useId } from 'react';
import type { SalesGrouping, SalesPoint } from '../../services/salesReportService';
import { salesDateLabel } from '../../services/salesReportService';
import { formatMoney } from '../period/PeriodControls';
import './sales-history-chart.css';

/** Serie unificada de ventas por período. */
export function SalesHistoryChart({ points, grouping = 'mes' }: {
  points: SalesPoint[]; grouping?: SalesGrouping;
}) {
  const titleId = useId();
  const amountOf = (point: SalesPoint) => Number(point.historico ?? 0) + Number(point.operativo ?? 0);
  const hasValue = (point: SalesPoint) => point.historico !== null || point.operativo !== null;
  const maximum = Math.max(1, ...points.map(amountOf));
  return <figure className="diza-sales-history" aria-labelledby={titleId}>
    <figcaption id={titleId} className="diza-sales-history-legend">
      <span><i className="is-operativo" aria-hidden="true" />Ventas (S/)</span>
    </figcaption>
    {!points.length ? <p className="diza-kpi-note">No hay registros para este período.</p> : <>
      <div className="diza-sales-history-scroll" role="region" aria-label="Evolución de ventas por período; desplazamiento horizontal" tabIndex={0}>
        <div className="diza-sales-history-plot">
          {points.map(point => {
            const total = amountOf(point);
            return <div className="diza-sales-history-period" key={point.periodo}>
              <div className="diza-sales-history-bars">
                <div className="diza-sales-history-series">
                  <span className="diza-sales-history-amount">{!hasValue(point) ? '—' : formatMoney(total)}</span>
                  <div className="diza-sales-history-track"><span className="is-operativo"
                    style={{ height: `${total / maximum * 100}%` }} /></div>
                </div>
              </div>
              <span className="diza-sales-history-date">{grouping === 'semana' ? 'Semana del ' : ''}{salesDateLabel(point.periodo, grouping)}</span>
            </div>;
          })}
        </div>
      </div>
      <p className="diza-kpi-note">Se muestran períodos con ventas registradas.</p>
    </>}
  </figure>;
}
