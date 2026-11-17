import type { MonthlyTotal } from './dashboardSelectors';

const soles = (value: number) => `S/ ${value.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;

/** Gráfico de barras ligero, sin librerías nuevas, con valores accesibles por texto. */
export function MonthlySalesChart({ months }: { months: MonthlyTotal[] }) {
  const largest = Math.max(0, ...months.map(item => item.amount));
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, largest / 4))));
  const upper = Math.max(4 * magnitude, Math.ceil(largest / (4 * magnitude)) * 4 * magnitude);
  const ticks = Array.from({ length: 5 }, (_, index) => upper * (4 - index) / 4);

  return (
    <figure className="diza-dashboard-sales-chart" aria-label="Ventas registradas por mes en los últimos seis meses">
      <div className="diza-dashboard-sales-plot">
        <div className="diza-dashboard-sales-axis" aria-hidden="true">
          {ticks.map(value => <span key={value}>{soles(value)}</span>)}
        </div>
        <div className="diza-dashboard-sales-canvas">
          <div className="diza-dashboard-sales-lines" aria-hidden="true">
            {ticks.map(value => <span key={value} />)}
          </div>
          <div className="diza-dashboard-sales-bars">
            {months.map(item => (
              <div className="diza-dashboard-sales-month" key={item.key}>
                <div className="diza-dashboard-sales-bar-track">
                  <div
                    className="diza-dashboard-sales-bar"
                    style={{ height: `${Math.max(0, item.amount) / upper * 100}%` }}
                    title={`${item.label}: ${soles(item.amount)}`}
                  />
                </div>
                <span className="diza-dashboard-sales-month-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="diza-dashboard-sales-caption">
        {largest === 0 ? 'No se han registrado ventas durante estos seis meses.' : 'Importes de ventas registradas por mes.'}
      </figcaption>
      <table className="diza-dashboard-visually-hidden">
        <caption>Importes mensuales de ventas</caption>
        <thead><tr><th>Mes</th><th>Total</th></tr></thead>
        <tbody>{months.map(item => <tr key={item.key}><th>{item.label}</th><td>{soles(item.amount)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
