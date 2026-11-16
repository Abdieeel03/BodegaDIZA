import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { mlService } from '../../services/mlService';
import { estimatedRevenue, estimatedRevenueSummary, formatSoles, getCurrentSalePrices, type PriceMap } from '../../services/mlRevenue';
import type { DemandPrediction, ReplenishmentRecommendation } from '../../types';
import './prediction-live.css';

const fmt = (value: number, digits = 2) => Number(value).toLocaleString('es-PE', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const readableName = (text: string) => text
  .replaceAll('Ã±', 'ñ').replaceAll('Ã¡', 'á').replaceAll('Ã©', 'é')
  .replaceAll('Ã­', 'í').replaceAll('Ã³', 'ó').replaceAll('Ãº', 'ú');

function DailyForecast({ values }: { values: number[] }) {
  const points = values.slice(0, 7);
  const maximum = Math.max(1, ...points);
  const x = (index: number) => 56 + index * 100;
  const y = (value: number) => 205 - (value / maximum) * 155;
  const path = points.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  return <div className="diza-ml-chart">
    <svg viewBox="0 0 720 245" role="img" aria-label="Demanda estimada de los próximos siete días posteriores al histórico">
      {[0, 0.5, 1].map(r => <g key={r}>
        <line x1="56" y1={y(maximum * r)} x2="656" y2={y(maximum * r)} stroke="#e2e9f5" />
        <text x="46" y={y(maximum * r) + 4} textAnchor="end" fill="#5e6e87" fontSize="12">{fmt(maximum * r, 1)}</text>
      </g>)}
      {points.length > 1 && <polyline fill="none" stroke="#285deb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={path} />}
      {points.map((value, index) => <g key={index}>
        <circle cx={x(index)} cy={y(value)} r="5" fill="#fff" stroke="#285deb" strokeWidth="3" />
        <text x={x(index)} y="231" textAnchor="middle" fill="#5e6e87" fontSize="12">Día {index + 1}</text>
      </g>)}
    </svg>
  </div>;
}

export const PredictionPage = () => {
  const [predictions, setPredictions] = useState<DemandPrediction[]>([]);
  const [replenishments, setReplenishments] = useState<ReplenishmentRecommendation[]>([]);
  const [productId, setProductId] = useState('');
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
      .then(([items, stock]) => {
        if (!active) return;
        setPredictions(items);
        setReplenishments(stock);
        setProductId(current => items.some(p => p.productId === current) ? current : (items[0]?.productId ?? ''));
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'No se pudo consultar la predicción.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    let active = true;
    setPricesLoading(true);
    setPriceError('');
    getCurrentSalePrices()
      .then(items => { if (active) setPrices(items); })
      .catch(err => { if (active) { setPrices({}); setPriceError(err instanceof Error ? err.message : 'No fue posible consultar precios.'); } })
      .finally(() => { if (active) setPricesLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const current = predictions.find(item => item.productId === productId);
  const stock = replenishments.find(item => item.productId === productId);
  const recommended = useMemo(() => replenishments.filter(item => Number(item.recommendedReplenishment) > 0)
    .sort((a, b) => Number(b.recommendedReplenishment) - Number(a.recommendedReplenishment)), [replenishments]);
  const totalDemand = predictions.reduce((sum, item) => sum + Number(item.predictedDemand7Days || 0), 0);
  const revenue = estimatedRevenueSummary(predictions, prices);
  const revenueLabel = pricesLoading ? 'Calculando...' : revenue.pricedProducts === 0
    ? 'No disponible' : formatSoles(revenue.total);
  const selectedRevenue = current ? estimatedRevenue(current, prices) : null;
  const selectedPrice = current ? prices[current.productId.trim().toUpperCase()] : undefined;

  return <main className="diza-ml-page">
    <header className="diza-ml-heading">
      <div><span className="diza-ml-eyebrow">BODEGA DIZA · PREDICCIÓN DE DEMANDA</span>
        <h1>Predicción de demanda</h1>
        <p>Pronóstico de siete días y recomendaciones de reposición conectados al modelo entrenado.</p>
      </div>
      <button type="button" onClick={() => setRefresh(value => value + 1)} className="diza-ml-button">Actualizar resultados</button>
    </header>

    {error && <div className="diza-ml-error" role="alert">{error}<p>Verifica que Spring Boot (8081) esté conectado al microservicio ML (8002) y que hayas iniciado sesión.</p></div>}
    {priceError && !loading && <p className="diza-ml-disclaimer" role="status">No se pueden mostrar los ingresos estimados: {priceError}. Las predicciones en unidades siguen disponibles.</p>}
    {loading ? <div className="diza-ml-card">Consultando las predicciones...</div> : !predictions.length ? <div className="diza-ml-card">
      No hay resultados disponibles. <Link to="/predicciones-ml">Ir a Entrenamiento ML</Link>
    </div> : <>
      <section className="diza-ml-stats" aria-label="Resumen del modelo" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))' }}>
        <article><span>Productos con pronóstico</span><strong>{predictions.length}</strong></article>
        <article><span>Demanda estimada · 7 días</span><strong>{fmt(totalDemand, 1)} unidades</strong></article>
        <article><span>Ingresos estimados · 7 días</span><strong>{revenueLabel}</strong>{!pricesLoading && revenue.pricedProducts > 0 && revenue.pricedProducts < revenue.products && <small>Solo {revenue.pricedProducts} de {revenue.products} productos con precio</small>}</article>
        <article><span>Productos por reponer</span><strong>{recommended.length}</strong></article>
        <article><span>Unidades sugeridas</span><strong>{fmt(recommended.reduce((s, p) => s + Number(p.recommendedReplenishment), 0), 0)} unidades</strong></article>
      </section>
      <section className="diza-ml-card">
        <div className="diza-ml-card-heading">
          <div><h2>Pronóstico por producto</h2><p>La fecha de inicio depende de la última venta registrada en el CSV de entrenamiento.</p></div>
          <label>Producto
            <select value={productId} onChange={e => setProductId(e.target.value)}>
              {predictions.map(item => <option key={item.productId} value={item.productId}>{item.productId} · {readableName(item.productName)}</option>)}
            </select>
          </label>
        </div>
        {current && <>
          <div className="diza-ml-stats diza-ml-stats-inside" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <article><span>Demanda de 7 días</span><strong>{fmt(Number(current.predictedDemand7Days))} unidades</strong></article>
            <article><span>Ingresos estimados · 7 días</span><strong>{pricesLoading ? 'Calculando...' : selectedRevenue === null ? 'No disponible' : formatSoles(selectedRevenue)}</strong>{selectedPrice !== undefined && <small>Precio actual: {formatSoles(selectedPrice)} por unidad</small>}</article>
            <article><span>Stock disponible</span><strong>{stock ? fmt(Number(stock.stockActual), 0) : '—'}</strong></article>
            <article><span>Stock mínimo</span><strong>{stock ? fmt(Number(stock.stockMinimoSeguridad), 0) : '—'}</strong></article>
            <article><span>Reposición sugerida</span><strong>{stock ? fmt(Number(stock.recommendedReplenishment), 0) : '—'}</strong></article>
          </div>
          <p>Demanda estimada por día (unidades):</p>
          <DailyForecast values={current.dailyPredictions} />
          <div className="diza-ml-daily">
            {current.dailyPredictions.slice(0, 7).map((value, index) => <span key={index}><small>Día {index + 1}</small><strong>{fmt(Number(value))} unidades</strong><small>{selectedPrice === undefined ? 'Ingreso no disponible' : formatSoles(Number(value) * selectedPrice)}</small></span>)}
          </div>
        </>}
      </section>
      <section className="diza-ml-card">
        <h2>Productos prioritarios para reposición</h2>
        {recommended.length === 0 ? <p>No hay sugerencias de reposición para el stock consultado.</p> : <div className="diza-ml-table-scroll">
          <table><thead><tr><th>Producto</th><th>Stock</th><th>Demanda 7 días (unidades)</th><th>Ingresos estimados (S/)</th><th>Reponer</th><th>Estado</th></tr></thead><tbody>
            {recommended.map(item => <tr key={item.productId}>
              <td>{readableName(item.productName)}</td><td>{fmt(Number(item.stockActual), 0)}</td>
              <td>{fmt(Number(item.predictedDemand7Days))}</td><td>{prices[item.productId.trim().toUpperCase()] === undefined ? '—' : formatSoles(Number(item.predictedDemand7Days) * prices[item.productId.trim().toUpperCase()])}</td><td><strong>{fmt(Number(item.recommendedReplenishment), 0)} unidades</strong></td>
              <td><span className={`diza-ml-status diza-ml-${item.alertStatus.toLowerCase()}`}>{item.alertStatus}</span></td>
            </tr>)}
          </tbody></table>
        </div>}
      </section>
      <p className="diza-ml-disclaimer">Los pronósticos son estimaciones basadas en días con ventas registradas; las fechas ausentes no equivalen a ventas cero. Los ingresos estimados (S/) se calculan multiplicando la demanda prevista por el precio de venta actual de cada producto en Inventario; no son ventas realizadas ni utilidad neta. No sustituyen el seguimiento del stock operativo ni validaciones con historiales diarios completos.</p>
    </>}
  </main>;
};

export default PredictionPage;
