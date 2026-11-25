import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { mlService } from '../../services/mlService';
import { Button, PageHeader, StatCard } from '../../components/ui';
import { ForecastLineChart } from '../../components/charts/ForecastLineChart';
import { estimatedRevenue, estimatedRevenueSummary, formatSoles, getCurrentSalePrices, type PriceMap } from '../../services/mlRevenue';
import type { DemandPrediction, ReplenishmentOptimizationResult, ReplenishmentRecommendation, TrainingResult } from '../../types';
import './prediction-live.css';

const fmt = (value: number, digits = 2) => Number(value).toLocaleString('es-PE', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const riskClass = (risk?: string | null) =>
  risk === 'ALTO' ? 'diza-ml-rojo' : risk === 'MEDIO' ? 'diza-ml-amarillo' : 'diza-ml-verde';

const readableName = (text: string) => text
  .replaceAll('Ã±', 'ñ').replaceAll('Ã¡', 'á').replaceAll('Ã©', 'é')
  .replaceAll('Ã­', 'í').replaceAll('Ã³', 'ó').replaceAll('Ãº', 'ú');

const dateLabel = (value?: string | null) => value
  ? new Date(value + 'T12:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No disponible';
const dateTimeLabel = (value?: string | null) => value
  ? new Date(value).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No disponible';
const dayLabel = (start: string | null | undefined, index: number) => {
  if (!start) return 'Día ' + (index + 1);
  const date = new Date(start + 'T12:00:00');
  date.setDate(date.getDate() + index);
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
};
const priority = { ROJO: 0, AMARILLO: 1, VERDE: 2 };
const priorityLabel = { ROJO: 'Alta', AMARILLO: 'Media', VERDE: 'Baja' };
const normalize = (value: string) => readableName(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

type PredictionView = 'summary' | 'product' | 'replenishment' | 'purchases';
const viewTitles: Record<PredictionView, string> = { summary: 'Predicción de demanda', product: 'Por producto', replenishment: 'Reposición', purchases: 'Planificar compras' };
const viewDescriptions: Record<PredictionView, string> = {
  summary: 'Una visión rápida de la demanda y las compras que requieren atención.',
  product: 'Analiza la demanda estimada y las necesidades de cada producto.',
  replenishment: 'Consulta qué productos reponer y por dónde empezar.',
  purchases: 'Distribuye tu presupuesto entre las necesidades de la bodega.',
};
export const PredictionPage = ({ view = 'summary' }: { view?: PredictionView }) => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = params.get('producto') ?? '';
  const setProductId = (value: string) => setParams({ producto: value }, { replace: true });
  const [priorityFilter, setPriorityFilter] = useState('');
  const [predictions, setPredictions] = useState<DemandPrediction[]>([]);
  const [replenishments, setReplenishments] = useState<ReplenishmentRecommendation[]>([]);
  const [search, setSearch] = useState('');
  const [training, setTraining] = useState<TrainingResult | null>(null);
  const [inventoryAsOf, setInventoryAsOf] = useState<string | null>(null);
  const [trainingLoading, setTrainingLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [prices, setPrices] = useState<PriceMap>({});
  const [pricesLoading, setPricesLoading] = useState(true);
  const [priceError, setPriceError] = useState('');
  const [budgetInput, setBudgetInput] = useState('500');
  const [optResult, setOptResult] = useState<ReplenishmentOptimizationResult | null>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [optError, setOptError] = useState('');

  const handleOptimizeBudget = async (event: FormEvent) => {
    event.preventDefault();
    const numericBudget = Number(budgetInput);
    if (!Number.isFinite(numericBudget) || numericBudget <= 0) {
      setOptError('Ingresa un presupuesto mayor a cero.');
      return;
    }
    setOptResult(null);
    setOptLoading(true);
    setOptError('');
    try {
      setOptResult(await mlService.optimizeReplenishments(numericBudget));
    } catch (err) {
      setOptError(err instanceof Error ? err.message : 'No fue posible optimizar las compras.');
    } finally {
      setOptLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setOptResult(null);
    Promise.all([mlService.getLatestPredictions(), mlService.getLatestReplenishmentSnapshot()])
      .then(([items, stock]) => {
        if (!active) return;
        setPredictions(items);
        setReplenishments(stock.items);
        setInventoryAsOf(stock.inventoryAsOf);
      })
      .catch(err => { if (active) { setPredictions([]); setReplenishments([]); setInventoryAsOf(null); setError(err instanceof Error ? err.message : 'No se pudo consultar la predicción.'); } })
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

  useEffect(() => {
    let active = true;
    setTrainingLoading(true);
    mlService.getLatestTraining().then(value => { if (active) setTraining(value); })
      .catch(() => { if (active) setTraining(null); })
      .finally(() => { if (active) setTrainingLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const matchingProducts = predictions.filter(item => normalize(item.productId + ' ' + item.productName).includes(normalize(search.trim())));
  const current = matchingProducts.find(item => item.productId === productId) ?? matchingProducts[0];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const expired = Boolean(training?.forecastToDate && training.forecastToDate < today);
  const stock = replenishments.find(item => item.productId === current?.productId);
  const recommended = useMemo(() => replenishments.filter(item => Number(item.recommendedReplenishment) > 0)
    .sort((a, b) => priority[a.alertStatus] - priority[b.alertStatus] || Number(b.stockoutProbability ?? 0) - Number(a.stockoutProbability ?? 0) || Number(b.recommendedReplenishment) - Number(a.recommendedReplenishment)), [replenishments]);
  const criticalCount = replenishments.filter(item => item.alertStatus === 'ROJO').length;
  const preventiveCount = replenishments.filter(item => item.alertStatus === 'AMARILLO').length;
  const coveredCount = replenishments.filter(item => item.alertStatus === 'VERDE').length;
  const visibleRecommendations = recommended.filter(item => (!priorityFilter || item.alertStatus === priorityFilter) && normalize(item.productId + ' ' + item.productName).includes(normalize(search.trim())));
  // La gráfica totaliza exclusivamente las series de siete días recibidas del modelo.
  // Si algún producto no trae siete valores válidos, no inventamos los faltantes.
  const dailySeries = useMemo(() => predictions.filter(item =>
    Array.isArray(item.dailyPredictions) && item.dailyPredictions.length >= 7 &&
    item.dailyPredictions.slice(0, 7).every(value => Number.isFinite(Number(value)) && Number(value) >= 0)
  ), [predictions]);
  const dailyTotalSeries = useMemo(() => Array.from({ length: 7 }, (_, index) =>
    dailySeries.reduce((sum, item) => sum + Number(item.dailyPredictions[index]), 0)
  ), [dailySeries]);
  const dailyRevenueSeries = useMemo(() => Array.from({ length: 7 }, (_, index) =>
    dailySeries.reduce((sum, item) => sum + Number(item.dailyPredictions[index]) * (prices[item.productId.trim().toUpperCase()] ?? 0), 0)
  ), [dailySeries, prices]);
  const revenue = estimatedRevenueSummary(predictions, prices);
  const hasPrices = revenue.pricedProducts > 0;
  const revenueLabel = pricesLoading ? 'Calculando...' : !hasPrices
    ? 'No disponible' : formatSoles(revenue.total);
  const selectedRevenue = current ? estimatedRevenue(current, prices) : null;
  const selectedPrice = current ? prices[current.productId.trim().toUpperCase()] : undefined;

  return <main className="diza-ml-page">
    <PageHeader
      title={viewTitles[view]}
      description={viewDescriptions[view]}
      actions={<div className="prediction-actions">
        {view === 'summary' && (
          <Button type="button" variant="primary"
            onClick={() => navigate('/prediccion-demanda/actualizar-modelo')}>
            Actualizar modelo
          </Button>
        )}
        <Button type="button" variant="secondary" disabled={loading || trainingLoading || optLoading}
          onClick={() => setRefresh(value => value + 1)}>Actualizar predicciones</Button>
      </div>}
    />

    {training && <section className="prediction-data-freshness" aria-label="Vigencia de los datos">
      <div><span>Pronóstico actual</span><strong>Generado: {dateTimeLabel(training.forecastGeneratedAt ?? training.trainedAt)}</strong><small>Ventas consideradas hasta: {dateLabel(training.forecastSalesCutoffDate ?? training.salesCutoffDate)}</small><small>Modelo entrenado: {dateTimeLabel(training.trainedAt)}</small></div>
      <div><span>Inventario actual</span><strong>Consultado: {dateTimeLabel(inventoryAsOf)}</strong><small>La reposición se recalcula con el stock actual.</small></div>
      <div><span>Período estimado</span><strong>{dateLabel(training.forecastFromDate)} – {dateLabel(training.forecastToDate)}</strong>{expired && <small className="prediction-period-expired">Período finalizado. Verifica el historial de ventas y actualiza las predicciones.</small>}</div>
    </section>}
    {error && <div className="diza-ml-error" role="alert">{error}<p>Intenta recargar los resultados. Si aún no hay un modelo, utiliza «Actualizar modelo».</p></div>}
    {priceError && !loading && <p className="diza-ml-disclaimer" role="status">No se pueden mostrar los ingresos estimados: {priceError}. Las predicciones en unidades siguen disponibles.</p>}
    {loading ? <div className="diza-ml-card">Consultando las predicciones...</div> : !predictions.length ? <div className="diza-ml-card">
      No hay resultados disponibles. {view === 'summary' ? 'Usa el botón «Actualizar modelo» del encabezado para generar el primer pronóstico.' : <Link to="/prediccion-demanda">Ir al Resumen para actualizar el modelo</Link>}
    </div> : <>
      {view === 'summary' && <section className="diza-ml-stats" aria-label="Resumen del modelo">
        <StatCard label="Ingresos estimados · 7 días" value={revenueLabel} note={!pricesLoading && revenue.pricedProducts > 0 && revenue.pricedProducts < revenue.products ? `Precios de ${revenue.pricedProducts} de ${revenue.products} productos` : `${predictions.length} productos con pronóstico`} />
        <StatCard label="Reposición urgente" value={criticalCount} note="Prioridad alta en los próximos días" />
        <StatCard label="Reposición preventiva" value={preventiveCount} note="Conviene programar pedido" />
        <StatCard label="Stock suficiente" value={coveredCount} note="Cubren la demanda de 7 días" />
      </section>}
      {view === 'summary' && <div className="prediction-summary-grid">
        <section className="diza-ml-card prediction-summary-graph" aria-labelledby="prediction-summary-graph-title">
          <div className="diza-ml-card-heading prediction-summary-graph-heading">
            <div>
              <h2 id="prediction-summary-graph-title">{hasPrices ? 'Ingresos estimados por día' : 'Tendencia de demanda'}</h2>
              <p>{hasPrices ? 'Proyección diaria en soles · 7 días' : 'Demanda estimada por día · 7 días'}</p>
            </div>
            {training?.forecastFromDate && training?.forecastToDate ? (
              <span className="prediction-summary-date" aria-label="Período del pronóstico">
                {dateLabel(training.forecastFromDate)} – {dateLabel(training.forecastToDate)}
              </span>
            ) : <span className="prediction-summary-date">7 días</span>}
          </div>
          {dailySeries.length ? (
            <>
              <ForecastLineChart
                values={hasPrices ? dailyRevenueSeries : dailyTotalSeries}
                startDate={training?.forecastFromDate}
                unit={hasPrices ? 'soles' : 'units'}
                title={hasPrices ? 'Ingresos diarios estimados durante siete días' : 'Demanda diaria estimada de los productos con pronóstico, durante siete días'}
              />
              {dailySeries.length !== predictions.length && <p className="prediction-summary-caveat" role="status">
                Se muestran {dailySeries.length} de {predictions.length} productos con datos diarios completos.
              </p>}
            </>
          ) : <p className="prediction-summary-caveat">El modelo no devolvió datos diarios suficientes para dibujar la tendencia.</p>}
          {expired && <p className="prediction-summary-caveat prediction-summary-caveat--expired" role="status">
            Este período ya terminó. Actualiza el modelo para consultar una estimación reciente.
          </p>}
        </section>
        <section className="diza-ml-card prediction-summary-replenishment">
          <div className="diza-ml-card-heading"><div><h2>Prioridades de reposición</h2></div><Link to="/prediccion-demanda/reposicion">Ver toda la reposición →</Link></div>
          <div className="prediction-priorities">{recommended.slice(0, 5).map((item, index) => <div key={item.productId} className="prediction-priority-item">
            <span className="prediction-rank">{index + 1}</span>
            <Link to={`/prediccion-demanda/producto?producto=${encodeURIComponent(item.productId)}`} className="prediction-priority-body">
              <strong>{readableName(item.productName)}</strong>
              <small>Stock: {fmt(item.stockActual, 0)} · {item.daysOfStockRemaining != null ? `Cubre ${fmt(Number(item.daysOfStockRemaining), 1)} días · ` : ''}Reponer: {fmt(item.recommendedReplenishment, 0)} u.</small>
            </Link>
            <span className={`diza-ml-status diza-ml-${item.alertStatus.toLowerCase()}`}>{priorityLabel[item.alertStatus]}</span>
            <Link className="prediction-priority-restock" to={`/inventario/agregar?modo=restock&sku=${encodeURIComponent(item.productId)}&cantidad=${Math.ceil(Number(item.recommendedReplenishment))}`}>Reponer</Link>
          </div>)}</div>
          {!recommended.length && <p>No hay productos pendientes de reposición.</p>}
          <div className="prediction-actions"><Link className="diza-ml-button" to="/prediccion-demanda/producto">Consultar un producto</Link><Link className="prediction-secondary" to="/prediccion-demanda/compras">Planificar compras →</Link></div>
        </section>
      </div>}
      {view === 'replenishment' && <section className="diza-ml-card">
        <h2>Qué necesitas reponer</h2>
        <div className="prediction-filters"><label>Buscar producto<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre o código" /></label><label>Prioridad<select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="">Todas</option><option value="ROJO">Alta</option><option value="AMARILLO">Media</option><option value="VERDE">Baja</option></select></label></div>
        {recommended.length === 0 ? <p>No hay sugerencias de reposición para el stock consultado.</p> : <div className="diza-ml-table-scroll">
          <table><thead><tr><th>Producto</th><th>Stock</th><th>Demanda 7 días</th><th>Cobertura actual</th><th>Riesgo estimado · 3 días (%)</th><th>Reponer</th><th>Prioridad</th><th>Acción</th></tr></thead><tbody>
            {visibleRecommendations.map(item => <tr key={item.productId}>
              <td><Link to={`/prediccion-demanda/producto?producto=${encodeURIComponent(item.productId)}`}>{readableName(item.productName)}</Link></td><td>{fmt(Number(item.stockActual), 0)}</td>
              <td>{fmt(Number(item.predictedDemand7Days))} u.</td>
              <td>{item.daysOfStockRemaining != null ? `${fmt(Number(item.daysOfStockRemaining), 1)} días` : '—'}</td>
              <td>{item.stockoutProbability != null ? `${fmt(Number(item.stockoutProbability) * 100, 1)}%` : '—'}</td>
              <td><strong>{fmt(Number(item.recommendedReplenishment), 0)} unidades</strong></td>
              <td><span className={`diza-ml-status diza-ml-${item.alertStatus.toLowerCase()}`}>{priorityLabel[item.alertStatus]}</span></td>
              <td><Link className="diza-ml-link" to={`/inventario/agregar?modo=restock&sku=${encodeURIComponent(item.productId)}&cantidad=${Math.ceil(Number(item.recommendedReplenishment))}`}>Reponer</Link></td>
            </tr>)}
          </tbody></table>
        </div>}
        {recommended.length > 0 && visibleRecommendations.length === 0 && <p>No hay productos que coincidan con estos filtros.</p>}
      </section>}
      {view === 'product' && <section className="diza-ml-card prediction-product">
        <div className="diza-ml-card-heading">
          <div><h2>Detalle por producto</h2><p>Busca un producto y consulta su demanda diaria, existencias y reposición sugerida.</p></div>
          <label>Buscar por nombre o código
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ej.: arroz o P001" />
          </label>
          <label>Producto
            <select disabled={!matchingProducts.length} value={current?.productId ?? ''} onChange={e => setProductId(e.target.value)}>
              {!matchingProducts.length && <option value="">Sin coincidencias</option>}
              {matchingProducts.map(item => <option key={item.productId} value={item.productId}>{item.productId} · {readableName(item.productName)}</option>)}
            </select>
          </label>
        </div>
        {!matchingProducts.length && <p role="status">No hay productos que coincidan con la búsqueda. <button type="button" onClick={() => setSearch('')}>Limpiar búsqueda</button></p>}
        {current && <>
          <div className="prediction-product-title"><span className="diza-ml-status">{current.category}</span><h2>{readableName(current.productName)}</h2><span>{current.productId}</span></div>
          <div className="prediction-forecast-panel"><div className="diza-ml-card-heading"><h3>Proyección · 7 días</h3><span className="diza-ml-status">Estimación del modelo</span></div>
          <p>Demanda estimada por día (unidades):</p>
          <ForecastLineChart values={current.dailyPredictions} startDate={training?.forecastFromDate} title={`Demanda estimada diaria de ${readableName(current.productName)} durante siete días`} />
          <div className="diza-ml-daily">
            {current.dailyPredictions.slice(0, 7).map((value, index) => <span key={index}><small>{dayLabel(training?.forecastFromDate, index)}</small><strong>{fmt(Number(value))} unidades</strong><small>{selectedPrice === undefined ? 'Ingreso no disponible' : formatSoles(Number(value) * selectedPrice)}</small></span>)}
          </div>
          </div>
          <div className="prediction-insights">
            <article><span className="prediction-card-label">INDICADOR ACTUAL</span><h3>Stock disponible</h3><strong>{stock ? fmt(stock.stockActual, 0) : '—'} <small>unidades</small></strong><p>Stock mínimo: {stock ? fmt(stock.stockMinimoSeguridad, 0) : '—'} unidades.</p><p>Cobertura estimada: {stock?.daysOfStockRemaining != null ? fmt(stock.daysOfStockRemaining, 1) + ' días' : 'No disponible'}.</p></article>
            <article><span className="prediction-card-label">DEMANDA PREVISTA</span><h3>Estimación del modelo</h3><strong>{fmt(current.predictedDemand7Days, 1)} <small>unidades</small></strong><p>Ingresos estimados: {pricesLoading ? 'Calculando...' : selectedRevenue === null ? 'No disponible' : formatSoles(selectedRevenue)}.</p><p>Riesgo de insuficiencia a 3 días sin reposición: {stock?.stockoutProbability != null ? fmt(stock.stockoutProbability * 100, 1) + '%' : 'No disponible'}.</p>{stock?.stockoutRiskLevel && <span className={`diza-ml-status ${riskClass(stock.stockoutRiskLevel)}`}>Riesgo {stock.stockoutRiskLevel.toLowerCase()}</span>}</article>
            <article className="prediction-action-card"><span className="prediction-card-label">ACCIÓN RECOMENDADA</span><h3>Reposición sugerida</h3><strong>{stock ? fmt(stock.recommendedReplenishment, 0) : '—'} <small>unidades</small></strong><p>Cantidad sugerida para cubrir la demanda y mantener el stock mínimo.</p><div className="prediction-actions"><Link className="diza-ml-button" to={`/inventario/agregar?modo=restock&sku=${encodeURIComponent(current.productId)}&cantidad=${stock ? Math.ceil(Number(stock.recommendedReplenishment)) : ''}`}>Reponer stock →</Link><Link className="prediction-secondary" to="/prediccion-demanda/compras">Planificar compra</Link></div></article>
          </div>
        </>}
      </section>}
      {view === 'purchases' && <section className="diza-ml-card">
        <div className="diza-ml-card-heading">
          <div>
            <h2>Planificar compras</h2>
            <p>Indica cuánto puedes gastar y consulta qué cantidades comprar. Este plan no registra compras ni modifica el inventario.</p>
          </div>
          <form onSubmit={handleOptimizeBudget} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label>Presupuesto (S/)
              <input
                type="number"
                min="1"
                step="0.5"
                value={budgetInput}
                disabled={optLoading} onChange={e => { setBudgetInput(e.target.value); setOptResult(null); setOptError(''); }}
                style={{ border: '1px solid #d4deec', borderRadius: 8, padding: '10px 12px', fontSize: 13, width: 140 }}
              />
            </label>
            <button type="submit" className="diza-ml-button" disabled={optLoading}>
              {optLoading ? 'Calculando plan...' : 'Calcular plan de compra'}
            </button>
          </form>
        </div>
        {optError && <div className="diza-ml-error" role="alert">{optError}</div>}
        {optResult && <>
          {!optResult.items.some(item => item.allocatedUnits > 0) && <p role="status">No se asignaron compras con este presupuesto y las necesidades actuales. Revisa el importe y las sugerencias de reposición.</p>}
          <div className="diza-ml-stats diza-ml-stats-inside" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <article><span>Presupuesto total</span><strong>{formatSoles(optResult.budget)}</strong></article>
            <article><span>Presupuesto usado</span><strong>{formatSoles(optResult.budgetUsed)}</strong></article>
            <article><span>Saldo restante</span><strong>{formatSoles(optResult.budgetRemaining)}</strong></article>
            <article><span>Productos incluidos</span><strong>{optResult.items.filter(item => item.allocatedUnits > 0).length}</strong></article>
          </div>
          <div className="diza-ml-table-scroll">
            <table><thead><tr><th>Producto</th><th>Prioridad</th><th>Sugerido</th><th>Compra asignada</th><th>Costo unit.</th><th>Costo total</th><th>Acción</th></tr></thead><tbody>
              {optResult.items.filter(item => item.allocatedUnits > 0).map(item => <tr key={item.productId}>
                <td>{readableName(item.productName)}</td>
                <td><span className={`diza-ml-status diza-ml-${item.alertStatus.toLowerCase()}`}>{priorityLabel[item.alertStatus]}</span></td>
                <td>{item.recommendedReplenishment}</td>
                <td><strong>{item.allocatedUnits} unidades</strong></td>
                <td>{formatSoles(item.unitCost)}</td>
                <td><strong>{formatSoles(item.totalCost)}</strong></td>
                <td><Link className="diza-ml-link" to={`/inventario/agregar?modo=restock&sku=${encodeURIComponent(item.productId)}&cantidad=${Math.ceil(Number(item.allocatedUnits))}`}>Reponer</Link></td>
              </tr>)}
            </tbody></table>
          </div>
        </>}
      </section>}
    </>}
  </main>;
};

export default PredictionPage;
