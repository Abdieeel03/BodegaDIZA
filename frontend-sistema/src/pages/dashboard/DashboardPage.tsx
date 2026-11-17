import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, PageHeader, StatCard, StatusBadge } from '../../components/ui';
import { DataFeedback } from '../../components/common/DataFeedback';
import { ForecastLineChart } from '../../components/charts/ForecastLineChart';
import { BusinessOverview } from './BusinessOverview';
import { useRemoteResource } from '../../hooks/useRemoteResource';
import { peruToday, salesDateLabel } from '../../services/salesReportService';
import { mlService } from '../../services/mlService';
import { estimatedRevenueSummary, formatSoles, getCurrentSalePrices, type PriceMap } from '../../services/mlRevenue';
import type { DemandPrediction, ReplenishmentRecommendation } from '../../types';
import './dashboard.css';

type ForecastState = { predictions: DemandPrediction[]; replenishments: ReplenishmentRecommendation[] };
const formatUnits = (amount: number) => amount.toLocaleString('es-PE', { maximumFractionDigits: 1 });
const readableName = (text: string) => text.replaceAll('Ã±', 'ñ').replaceAll('Ã©', 'é').replaceAll('Ã¡', 'á');
const alertPriority = { ROJO: 0, AMARILLO: 1, VERDE: 2 };
const alertLabel = { ROJO: 'Alta', AMARILLO: 'Media', VERDE: 'Baja' };

export const DashboardPage = () => {
  const [data, setData] = useState<ForecastState>({ predictions: [], replenishments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [prices, setPrices] = useState<PriceMap>({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [priceError, setPriceError] = useState('');
  const loadTraining = useCallback(() => { void refresh; return mlService.getLatestTraining(); }, [refresh]);
  const training = useRemoteResource(loadTraining, true);

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

  const revenue = estimatedRevenueSummary(data.predictions, prices);
  const hasPrices = revenue.pricedProducts > 0;
  const revenueLabel = pricesLoading ? 'Calculando...' : !hasPrices
    ? 'No disponible' : formatSoles(revenue.total);
  const urgent = data.replenishments
    .filter(item => Number(item.recommendedReplenishment) > 0)
    .sort((a, b) => alertPriority[a.alertStatus] - alertPriority[b.alertStatus]
      || Number(b.stockoutProbability ?? 0) - Number(a.stockoutProbability ?? 0)
      || Number(b.recommendedReplenishment) - Number(a.recommendedReplenishment));
  const criticalCount = data.replenishments.filter(item => item.alertStatus === 'ROJO').length;
  const preventiveCount = data.replenishments.filter(item => item.alertStatus === 'AMARILLO').length;
  const coveredCount = data.replenishments.filter(item => item.alertStatus === 'VERDE').length;
  const dailyUnits = Array.from({ length: 7 }, (_, day) => data.predictions.reduce((sum, item) => sum + Number(item.dailyPredictions[day] || 0), 0));
  const dailyRevenue = Array.from({ length: 7 }, (_, day) =>
    data.predictions.reduce((sum, item) => sum + Number(item.dailyPredictions[day] || 0) * (prices[item.productId] ?? 0), 0));

  return (
    <main className="diza-dashboard">
      <PageHeader
        title="Inicio"
        actions={<Button variant="secondary" size="sm" loading={loading} onClick={() => setRefresh(value => value + 1)}>Recargar resultados</Button>}
      />

      <BusinessOverview revision={refresh} />

      <section className="diza-dashboard-section" aria-labelledby="diza-forecast-title">
        <div className="diza-dashboard-section-heading">
          <div>
            <h2 id="diza-forecast-title">Predicción y reposición</h2>
          </div>
          <Link to="/prediccion-demanda" className="diza-dashboard-text-link">Explorar predicciones</Link>
        </div>

        {training.data && <p className="diza-dashboard-legal">
          Período del pronóstico: {training.data.forecastFromDate ? salesDateLabel(training.data.forecastFromDate) : 'No disponible'} – {training.data.forecastToDate ? salesDateLabel(training.data.forecastToDate) : 'No disponible'}.
          {training.data.forecastToDate && training.data.forecastToDate < peruToday() && <strong> Período finalizado. Actualiza el modelo desde Predicción de demanda.</strong>}
        </p>}
        {training.status === 'error' && <p className="diza-dashboard-notice" role="status">No se pudo verificar la fecha del modelo. Recarga los resultados antes de utilizar la proyección para planificar compras.</p>}

        {loading ? (
          <DataFeedback status="loading" title="Consultando predicciones" description="Obteniendo la proyección y las necesidades de reposición." />
        ) : error ? (
          <DataFeedback status="error" title="No se pudo consultar la predicción" description={error} onRetry={() => setRefresh(value => value + 1)} />
        ) : data.predictions.length === 0 ? (
          <div className="diza-dashboard-empty">
            <DataFeedback status="empty" title="Todavía no hay pronósticos" description="Genera o consulta predicciones desde el módulo de demanda." onRetry={() => setRefresh(value => value + 1)} />
            <Link to="/prediccion-demanda" className="diza-dashboard-text-link">Ir a Predicción de demanda</Link>
          </div>
        ) : (
          <>
            {priceError && !pricesLoading && <p className="diza-dashboard-notice" role="status">No se pudieron consultar los precios: {priceError}. Las cantidades previstas siguen disponibles.</p>}
            <div className="diza-dashboard-kpis" aria-label="Indicadores de predicción">
              <StatCard label="Ingresos estimados · 7 días" value={revenueLabel} note={pricesLoading ? 'Consultando precios de venta' : revenue.pricedProducts < revenue.products ? `Precios disponibles: ${revenue.pricedProducts} de ${revenue.products}` : `${data.predictions.length} productos con pronóstico`} />
              <StatCard label="Reposición urgente" value={criticalCount} note="Prioridad alta en los próximos días" />
              <StatCard label="Reposición preventiva" value={preventiveCount} note="Prioridad media para programar pedido" />
              <StatCard label="Stock suficiente" value={coveredCount} note="Cubren la demanda de 7 días" />
            </div>

            <div className="diza-dashboard-analytics">
              <section className="diza-dashboard-panel" aria-labelledby="diza-demand-chart-title">
                <div className="diza-dashboard-panel-heading">
                  <div><h3 id="diza-demand-chart-title">{hasPrices ? 'Ingresos estimados por día' : 'Tendencia de demanda'}</h3></div>
                  <span className="diza-dashboard-panel-tag">7 días</span>
                </div>
                <ForecastLineChart
                  values={hasPrices ? dailyRevenue : dailyUnits}
                  startDate={training.data?.forecastFromDate}
                  unit={hasPrices ? 'soles' : 'units'}
                  title={hasPrices ? 'Ingresos estimados por día en siete días' : 'Demanda prevista por día en siete días'}
                />
                <p className="diza-dashboard-chart-foot">Total estimado en 7 días: <strong>{revenueLabel}</strong></p>
              </section>

              <section className="diza-dashboard-panel diza-dashboard-panel--ranking" aria-labelledby="diza-priorities-title">
                <div className="diza-dashboard-panel-heading">
                  <div><h3 id="diza-priorities-title">Reposición prioritaria</h3></div>
                </div>
                <div className="diza-dashboard-priorities">
                  {urgent.length ? urgent.slice(0, 5).map((item, index) => (
                    <div key={item.productId} className="diza-dashboard-priority">
                      <span className="diza-dashboard-priority-number" aria-hidden="true">{index + 1}</span>
                      <Link to={`/prediccion-demanda/producto?producto=${encodeURIComponent(item.productId)}`} className="diza-dashboard-priority-body">
                        <strong>{readableName(item.productName)}</strong>
                        <small>Stock: {formatUnits(Number(item.stockActual))} · Reponer: {formatUnits(Number(item.recommendedReplenishment))}</small>
                      </Link>
                      <StatusBadge tone={item.alertStatus === 'ROJO' ? 'danger' : item.alertStatus === 'AMARILLO' ? 'warning' : 'success'}>{alertLabel[item.alertStatus]}</StatusBadge>
                      <Link className="diza-dashboard-priority-restock" to={`/inventario/agregar?modo=restock&sku=${encodeURIComponent(item.productId)}&cantidad=${Math.ceil(Number(item.recommendedReplenishment))}`}>
                        Reponer
                      </Link>
                    </div>
                  )) : <p className="diza-dashboard-priority-empty">No hay productos con reposición sugerida.</p>}
                </div>
                <Link className="diza-dashboard-panel-action" to="/prediccion-demanda/reposicion">Ver todas las recomendaciones <span aria-hidden="true">→</span></Link>
              </section>
            </div>
          </>
        )}
      </section>

    </main>
  );
};

export default DashboardPage;
