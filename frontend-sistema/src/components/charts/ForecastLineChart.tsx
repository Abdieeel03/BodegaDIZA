import './forecast-line-chart.css';

type Props = {
  /** Cantidades o importes diarios previstos, nunca totales de ventas reales. */
  values: number[];
  startDate?: string | null;
  title: string;
  unit?: 'units' | 'soles';
};

const formatUnits = (amount: number) => amount.toLocaleString('es-PE', { maximumFractionDigits: 1 });
const formatSoles = (amount: number) => `S/ ${amount.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;

function labelForDay(startDate: string | null | undefined, index: number): string {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return `Día ${index + 1}`;
  const date = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return `Día ${index + 1}`;
  date.setDate(date.getDate() + index);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}

/** Un único gráfico de siete días para Inicio y Predicción de demanda. */
export function ForecastLineChart({ values, startDate, title, unit = 'units' }: Props) {
  const formatValue = unit === 'soles' ? formatSoles : formatUnits;
  const points = Array.from({ length: 7 }, (_, index) => {
    const value = Number(values[index] ?? 0);
    return Number.isFinite(value) ? value : 0;
  });
  const minimum = Math.min(0, ...points);
  const maximum = Math.max(1, ...points);
  const range = maximum - minimum;
  const x = (index: number) => 64 + index * 101;
  const y = (value: number) => 202 - ((value - minimum) / range) * 158;
  const polyline = points.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const area = `64,${y(0)} ${polyline} 670,${y(0)}`;
  const labels = points.map((value, index) => ({ day: labelForDay(startDate, index), value }));

  return (
    <figure className="diza-forecast" aria-label={title}>
      <div className="diza-forecast-graphic">
        <svg viewBox="0 0 734 248" role="img" aria-label={title}>
          <title>{title}</title>
          {[0, 0.5, 1].map(level => {
            const value = minimum + level * range;
            return (
              <g key={level}>
                <line x1="64" y1={y(value)} x2="670" y2={y(value)} className="diza-forecast-grid" />
                <text x="53" y={y(value) + 4} textAnchor="end" className="diza-forecast-axis">{formatValue(value)}</text>
              </g>
            );
          })}
          <polygon points={area} className="diza-forecast-area" />
          <polyline points={polyline} className="diza-forecast-line" />
          {labels.map(({ day, value }, index) => (
            <g key={index}>
              <circle cx={x(index)} cy={y(value)} r="4.5" className="diza-forecast-dot" />
              <text x={x(index)} y="233" textAnchor="middle" className="diza-forecast-axis">{day}</text>
            </g>
          ))}
        </svg>
      </div>
      <div className="diza-forecast-mobile" aria-label="Valores diarios del pronóstico">
        {labels.map(({ day, value }, index) => (
          <div className="diza-forecast-mobile-day" key={index}>
            <span>{day}</span><strong>{formatValue(value)}</strong><small>{unit === 'soles' ? 'estimado' : 'unidades'}</small>
          </div>
        ))}
      </div>
    </figure>
  );
}
