import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { mlService } from '../../services/mlService';
import { estimatedRevenueSummary, formatSoles, getCurrentSalePrices, type PriceMap } from '../../services/mlRevenue';
import type { DemandPrediction, ReplenishmentRecommendation } from '../../types';
import { OperationalOverview } from './OperationalOverview';
import './dashboard.css';

const formatUnits = (amount: number) => amount.toLocaleString('es-PE', { maximumFractionDigits: 1 });
const readableName = (text: string) => text.replaceAll('Ã±', 'ñ').replaceAll('Ã©', 'é').replaceAll('Ã¡', 'á');

type ForecastState = { predictions: DemandPrediction[]; replenishments: ReplenishmentRecommendation[] };

export const DashboardPage = () => {
  const [data, setData] = useState<ForecastState>({ predictions: [], replenishments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [prices, setPrices] = useState<PriceMap>({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [priceError, setPriceError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([mlService.getLatestPredictions(), mlService.getLatestReplenishments()])
      .then(([predictions, replenishments]) => { if (active) setData({ predictions, replenishments }); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'No se encontraron los pronósticos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    let active = true;
    setPricesLoading(true);
    setPriceError('');
    getCurrentSalePrices()
      .then(items => { if (active) setPrices(items); })
      .catch(err => { if (active) { setPrices({}); setPriceError(err instanceof Error ? err.message : 'Error al consultar precios.'); } })
      .finally(() => { if (active) setPricesLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const demand = data.predictions.reduce((sum, item) => sum + Number(item.predictedDemand7Days || 0), 0);
  const revenue = estimatedRevenueSummary(data.predictions, prices);
  const revenueLabel = pricesLoading ? 'Calculando...' : revenue.pricedProducts === 0
    ? 'No disponible' : formatSoles(revenue.total);
  const urgent = [...data.replenishments].filter(item => Number(item.recommendedReplenishment) > 0)
    .sort((a, b) => Number(b.recommendedReplenishment) - Number(a.recommendedReplenishment));
  const toBuy = urgent.reduce((sum, item) => sum + Number(item.recommendedReplenishment), 0);
  const daily = Array.from({ length: 7 }, (_, day) => data.predictions.reduce((sum, item) => sum + Number(item.dailyPredictions[day] || 0), 0));
  const maximum = Math.max(1, ...daily);
  const x = (index: number) => 46 + index * 88;
  const y = (value: number) => 205 - (value / maximum) * 160;

  return <main className="diza-dashboard">
    <OperationalOverview />
    <header className="diza-dashboard-heading">
      <div><p className="diza-location">BODEGA DIZA</p><h1>Predicción y reposición</h1>
        <p>Datos obtenidos del modelo entrenado, independientes de las ventas operativas del período.</p></div>
      <button type="button" className="diza-ranking-link" style={{ border: 0, cursor: 'pointer' }} onClick={() => setRefresh(n => n + 1)}>Actualizar predicción</button>
    </header>
    {error && <p role="alert" style={{ color: '#b42332' }}>{error}. Comprueba la conexión entre Spring Boot y el microservicio ML.</p>}
    {priceError && !loading && <p role="status">Los ingresos estimados no están disponibles: {priceError}. Los pronósticos en unidades sí se muestran.</p>}
    {loading ? <section className="diza-chart-card"><p>Consultando predicciones...</p></section> : <>
      <section className="diza-indicators" aria-label="Resumen de predicciones" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))' }}>
        {[
          { title: 'Demanda prevista · 7 días', value: `${formatUnits(demand)} unidades`, detail: 'Según histórico registrado', icon: '▦' },
          { title: 'Ingresos estimados · 7 días', value: revenueLabel, detail: revenue.pricedProducts < revenue.products && !pricesLoading ? `Precios de ${revenue.pricedProducts}/${revenue.products} productos` : 'A precios de venta actuales', icon: 'S/' },
          { title: 'Productos pronosticados', value: String(data.predictions.length), detail: 'Con historial disponible', icon: '▣' },
          { title: 'Productos por reponer', value: String(urgent.length), detail: 'Basado en stock actual', icon: '⚠' },
          { title: 'Reposición sugerida', value: `${formatUnits(toBuy)} unidades`, detail: 'Para mantener reserva mínima', icon: '▤' },
        ].map(item => <article key={item.title} className="diza-kpi">
          <span className="diza-kpi-icon">{item.icon}</span><div className="diza-kpi-info">
            <span className="diza-kpi-title">{item.title}</span><strong className="diza-kpi-value">{item.value}</strong>
            <span className="diza-chip diza-neutro">{item.detail}</span>
          </div>
        </article>)}
      </section>
      <div className="diza-analytics">
        <section className="diza-chart-card">
          <div className="diza-chart-header"><h3>Demanda estimada durante 7 días (unidades)</h3></div>
          {data.predictions.length ? <div className="diza-chart-container">
            <svg viewBox="0 0 630 250" role="img" aria-label="Demanda estimada agregada para siete días">
              {[0, 0.5, 1].map(r => <g key={r}>
                <line x1="46" x2="574" y1={y(maximum * r)} y2={y(maximum * r)} stroke="#e3e9f2" />
                <text x="38" y={y(maximum * r) + 4} textAnchor="end" fill="#66738d" fontSize="11">{formatUnits(maximum * r)}</text>
              </g>)}
              <polyline fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" points={daily.map((n, i) => `${x(i)},${y(n)}`).join(' ')} />
              {daily.map((n, i) => <g key={i}><circle cx={x(i)} cy={y(n)} r="4" fill="#fff" stroke="#2563eb" strokeWidth="3" />
                <text x={x(i)} y="234" textAnchor="middle" fill="#66738d" fontSize="11">Día {i + 1}</text></g>)}
            </svg>
          </div> : <p>No hay entrenamiento disponible.</p>}
          <div className="diza-chart-footer"><span>Basado en fechas con ventas observadas.</span><strong>{formatUnits(demand)} unidades · {revenueLabel} estimados</strong></div>
        </section>
        <section className="diza-ranking">
          <div className="diza-ranking-header"><h3>Reposición prioritaria</h3><span>{urgent.length} productos</span></div>
          <div className="diza-ranking-list">
            {urgent.length ? urgent.slice(0, 5).map((item, i) => <div className="diza-ranking-item" key={item.productId}>
              <span className="diza-ranking-number">{i + 1}</span><div className="diza-ranking-info">
                <strong title={readableName(item.productName)}>{readableName(item.productName)}</strong>
                <small>Stock {formatUnits(Number(item.stockActual))} · Reponer {formatUnits(Number(item.recommendedReplenishment))}</small>
              </div>
              <span className={`diza-chip diza-${item.alertStatus === 'ROJO' ? 'peligro' : 'advertencia'}`}>{item.alertStatus}</span>
            </div>) : <p>Sin reposiciones sugeridas.</p>}
          </div>
          <Link className="diza-ranking-link" to="/prediccion-demanda">Ver predicciones de todos los productos →</Link>
        </section>
      </div>
      <p className="diza-disclaimer">La proyección de siete días parte del cierre del histórico utilizado para entrenar el modelo; no representa necesariamente los siete días posteriores a hoy. Los ingresos estimados (S/) utilizan los precios de venta actuales de Inventario: no son ventas registradas ni utilidad neta.</p>
    </>}
  </main>;
};

export default DashboardPage;
