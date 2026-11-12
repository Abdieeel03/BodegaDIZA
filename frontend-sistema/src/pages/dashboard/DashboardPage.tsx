import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DemandPrediction, ReplenishmentRecommendation } from '../../types';
import { mlService } from '../../services/mlService';
import './dashboard.css';

const chartX = (index: number, total: number) => 55 + index * (545 / Math.max(total - 1, 1));

type DashboardData = {
  predictions: DemandPrediction[];
  replenishments: ReplenishmentRecommendation[];
};

function DemandChart({ dailyDemand }: { dailyDemand: number[] }) {
  const maximum = Math.max(...dailyDemand, 1);
  const y = (value: number) => 225 - (value / maximum) * 190;
  const points = dailyDemand.map((value, index) => `${chartX(index, dailyDemand.length)},${y(value)}`).join(' ');

  return (
    <div className="diza-chart-card">
      <div className="diza-chart-header">
        <h3>Demanda prevista por día</h3>
        <div className="diza-legend">
          <span><i className="diza-estimado" /> Próximos 7 días</span>
        </div>
      </div>
      <div className="diza-chart-container">
        {dailyDemand.some((value) => value > 0) ? (
          <svg viewBox="0 0 640 280" role="img" aria-label="Demanda prevista para los próximos siete días">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <g key={ratio}>
                <line x1="55" y1={y(maximum * ratio)} x2="600" y2={y(maximum * ratio)} stroke="#e4e9f2" />
                <text x="47" y={y(maximum * ratio) + 4} textAnchor="end" fontSize="11" fill="#66738d">
                  {(maximum * ratio).toFixed(0)}
                </text>
              </g>
            ))}
            {dailyDemand.map((_, index) => (
              <text key={index} x={chartX(index, dailyDemand.length)} y="254" textAnchor="middle" fontSize="11" fill="#66738d">
                Día {index + 1}
              </text>
            ))}
            <polyline
              fill="none"
              stroke="#244695"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
            />
            {dailyDemand.map((value, index) => (
              <circle key={index} cx={chartX(index, dailyDemand.length)} cy={y(value)} r="5" fill="#fff" stroke="#244695" strokeWidth="3" />
            ))}
          </svg>
        ) : (
          <p>No hay una predicción entrenada todavía.</p>
        )}
      </div>
      <div className="diza-chart-footer">
        <span>Demanda agregada de todos los productos.</span>
        <strong>{dailyDemand.reduce((total, value) => total + value, 0).toFixed(0)} unidades estimadas</strong>
      </div>
    </div>
  );
}

function ReplenishmentRanking({ items }: { items: ReplenishmentRecommendation[] }) {
  const maximum = Math.max(...items.map((item) => item.recommendedReplenishment), 1);
  const chipClass = (alert: ReplenishmentRecommendation['alertStatus']) => {
    if (alert === 'ROJO') return 'peligro';
    if (alert === 'AMARILLO') return 'advertencia';
    return 'positivo';
  };

  return (
    <section className="diza-ranking">
      <div className="diza-ranking-header">
        <h3>Reposición prioritaria</h3>
        <span>Top 5 recomendado</span>
      </div>
      <div className="diza-ranking-list">
        {items.length ? items.slice(0, 5).map((item, index) => (
          <div className="diza-ranking-item" key={item.productId}>
            <span className="diza-ranking-number">{index + 1}</span>
            <div className="diza-ranking-info">
              <strong title={item.productName}>{item.productName}</strong>
              <small>Reponer {item.recommendedReplenishment.toFixed(0)} uds</small>
              <div className="diza-ranking-track">
                <div style={{ width: `${(item.recommendedReplenishment / maximum) * 100}%` }} />
              </div>
            </div>
            <span className={`diza-chip diza-${chipClass(item.alertStatus)}`}>{item.alertStatus}</span>
          </div>
        )) : <p>No hay recomendaciones disponibles.</p>}
      </div>
      <Link to="/predicciones" className="diza-ranking-link">
        Entrenar o actualizar modelo <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export const DashboardPage = () => {
  const [data, setData] = useState<DashboardData>({ predictions: [], replenishments: [] });

  useEffect(() => {
    Promise.all([mlService.getLatestPredictions(), mlService.getLatestReplenishments()])
      .then(([predictions, replenishments]) => setData({ predictions, replenishments }))
      .catch(() => setData({ predictions: [], replenishments: [] }));
  }, []);

  const predictedDemand = data.predictions.reduce((total, item) => total + item.predictedDemand7Days, 0);
  const recommendedUnits = data.replenishments.reduce((total, item) => total + item.recommendedReplenishment, 0);
  const criticalProducts = data.replenishments.filter((item) => item.alertStatus === 'ROJO').length;
  const dailyDemand = Array.from({ length: 7 }, (_, index) => data.predictions.reduce(
    (total, item) => total + (item.dailyPredictions[index] || 0),
    0
  ));
  const indicators = [
    { title: 'Demanda estimada', value: `${predictedDemand.toFixed(0)} uds`, detail: 'Próximos 7 días', icon: '▦', status: 'neutro' },
    { title: 'Productos analizados', value: data.predictions.length.toString(), detail: 'Con pronóstico activo', icon: '▣', status: 'positivo' },
    { title: 'En riesgo', value: `${criticalProducts} SKUs`, detail: 'Stock crítico', icon: '⚠', status: 'peligro' },
    { title: 'Reposición sugerida', value: `${recommendedUnits.toFixed(0)} uds`, detail: 'Unidades a reponer', icon: '▤', status: 'advertencia' },
  ];

  return (
    <div className="diza-dashboard">
      <div className="diza-dashboard-heading">
        <div>
          <p className="diza-location">BODEGA DIZA · VILLA EL SALVADOR</p>
          <h1>Dashboard</h1>
          <p>Resumen de la operación y demanda estimada.</p>
        </div>
        <span className="diza-demo">● {data.predictions.length ? 'Predicción actualizada' : 'Modelo pendiente'}</span>
      </div>
      <section className="diza-indicators" aria-label="Resumen de indicadores">
        {indicators.map((item) => (
          <article key={item.title} className={`diza-kpi ${item.status === 'peligro' ? 'diza-kpi-risk' : ''}`}>
            <span className="diza-kpi-icon" aria-hidden="true">{item.icon}</span>
            <div className="diza-kpi-info">
              <span className="diza-kpi-title">{item.title}</span>
              <strong className="diza-kpi-value">{item.value}</strong>
              <span className={`diza-chip diza-${item.status}`}>{item.detail}</span>
            </div>
          </article>
        ))}
      </section>
      <h2 className="diza-section-title">Proyección de inventario</h2>
      <div className="diza-analytics">
        <DemandChart dailyDemand={dailyDemand} />
        <ReplenishmentRanking items={data.replenishments} />
      </div>
      <p className="diza-disclaimer">
        Las estimaciones se actualizan al entrenar el modelo con los CSV de ventas y productos.
      </p>
    </div>
  );
};

export default DashboardPage;
