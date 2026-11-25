import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, type TrainingResult } from '../../types';
import { mlService } from '../../services/mlService';
import { Button } from '../../components/ui';
import './predictions-ml.css';

type ModelTrainingPanelProps = {
  onCompleted?: () => void;
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return 'No disponible';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  return date.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatShortDate = (value?: string | null) => {
  if (!value) return 'No disponible';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Mantener el entrenamiento real: POST /ml/trainings con los datos registrados.
// Este panel no carga archivos ni modifica el stock de forma directa.
export const ModelTrainingPanel = ({ onCompleted }: ModelTrainingPanelProps) => {
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [latestLoading, setLatestLoading] = useState(true);
  const [latestError, setLatestError] = useState('');
  const [latestRevision, setLatestRevision] = useState(0);
  const [resultOrigin, setResultOrigin] = useState<'latest' | 'new'>('latest');
  const trainingRequested = useRef(false);

  // Mostrar las métricas del último entrenamiento al abrir la pantalla,
  // sin exigir un nuevo entrenamiento ni un clic para desplegarlas.
  useEffect(() => {
    let active = true;
    setLatestLoading(true);
    setLatestError('');
    void mlService.getLatestTraining()
      .then(last => {
        if (active && !trainingRequested.current) {
          setResult(last);
          setResultOrigin('latest');
        }
      })
      .catch(() => {
        if (active) setLatestError('No se pudo consultar el último entrenamiento. Reintenta la consulta; si todavía no existe un modelo, genera las primeras predicciones.');
      })
      .finally(() => { if (active) setLatestLoading(false); });
    return () => { active = false; };
  }, [latestRevision]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading || latestLoading || trainingRequested.current) return;
    trainingRequested.current = true;
    setError(null);
    setResultOrigin('latest');
    setLatestError('');
    setIsLoading(true);
    try {
      const completed = await mlService.train();
      setResult(completed);
      setResultOrigin('new');
      onCompleted?.(); // Refrescar información si una vista padre lo necesita.
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : requestError instanceof Error ? requestError.message : 'No fue posible actualizar el modelo.');
    } finally {
      trainingRequested.current = false;
      setIsLoading(false);
    }
  };

  return (
    <section className="diza-model-panel" id="diza-model-training-panel" aria-labelledby="diza-model-training-title">
      <div className="diza-model-panel-heading">
        <div>
          <span className="diza-model-eyebrow">MODELO DE DEMANDA</span>
          <h2 id="diza-model-training-title">Entrenamiento del modelo</h2>
          <p>Utiliza el historial de ventas y el inventario registrados.</p>
        </div>
        <span className="diza-model-horizon">Horizonte: 7 días</span>
      </div>

      <form onSubmit={handleSubmit} className="diza-model-action-row">
        <p>No requiere archivos ni modifica el stock. El entrenamiento puede tardar unos minutos.</p>
        <Button type="submit" loading={isLoading} disabled={isLoading || latestLoading}>
          {isLoading ? 'Entrenando modelo...' : 'Entrenar modelo'}
        </Button>
      </form>

      {latestLoading && <p className="diza-model-info" role="status">Consultando el último entrenamiento guardado…</p>}
      {latestError && <div className="diza-model-error" role="alert"><p>{latestError}</p>
        <Button variant="secondary" size="sm" disabled={isLoading} onClick={() => setLatestRevision(value => value + 1)}>Reintentar consulta</Button>
      </div>}

      {isLoading && <p className="diza-model-info" role="status">Entrenando el modelo con los datos registrados…</p>}
      {error && <div className="diza-model-error" role="alert">{error} Revisa la conexión con el servicio ML e inténtalo nuevamente.</div>}

      {result && <div className="diza-model-result" role="status">
        <div className="diza-model-result-heading">
          <div>
            <h3>{resultOrigin === 'new' ? 'Predicciones actualizadas' : 'Último entrenamiento disponible'}</h3>
            <p>{resultOrigin === 'new'
              ? 'Entrenamiento completado. Vuelve al Resumen para consultar los nuevos pronósticos.'
              : `Entrenado el ${formatDateTime(result.trainedAt)} · Pronóstico: ${formatShortDate(result.forecastFromDate)} – ${formatShortDate(result.forecastToDate)}`}</p>
          </div>
          <span className="diza-model-success">Modelo listo</span>
        </div>
        <div className="diza-model-kpis">
          <div><span>Último entrenamiento</span><strong>{formatDateTime(result.trainedAt)}</strong></div>
          <div><span>Productos</span><strong>{result.productsCount}</strong></div>
          <div><span>Observaciones</span><strong>{result.observationsCount}</strong></div>
          <div><span>Modelo seleccionado</span><strong>{result.modelName.replaceAll('_', ' ')}</strong></div>
        </div>

        <section className="diza-model-technical" aria-labelledby="diza-model-metrics-title">
          <h4 id="diza-model-metrics-title">Métricas del entrenamiento</h4>
          <div className="diza-model-metrics">
            <div><span>MAE</span><strong>{result.metrics.mae.toFixed(2)}</strong></div>
            <div><span>RMSE</span><strong>{result.metrics.rmse.toFixed(2)}</strong></div>
            <div><span>WAPE</span><strong>{result.metrics.wape.toFixed(1)}%</strong></div>
          </div>
          {result.hillClimbing && <div className="diza-model-technical-detail">
            <strong>Optimización Hill Climbing</strong>
            <p>{result.hillClimbing.iterations} iteraciones · {result.hillClimbing.evaluatedNeighbors} vecinos evaluados · MAE validación {result.hillClimbing.initialMae.toFixed(4)} → {result.hillClimbing.bestMae.toFixed(4)} ({result.hillClimbing.improved ? 'mejorado' : 'óptimo local inicial'}).</p>
            <p>Parámetros: {Object.entries(result.hillClimbing.bestParams).map(([key, value]) => `${key}=${value}`).join(' · ')}</p>
          </div>}
          {result.classification && <div className="diza-model-technical-detail">
            <strong>Clasificador de riesgo de agotamiento: {result.classification.modelName.replaceAll('_', ' ')}</strong>
            <div className="diza-model-metrics">
              <div><span>F1-Score</span><strong>{(result.classification.metrics.f1 * 100).toFixed(1)}%</strong></div>
              <div><span>Exactitud</span><strong>{(result.classification.metrics.accuracy * 100).toFixed(1)}%</strong></div>
              <div><span>Sensibilidad</span><strong>{(result.classification.metrics.recall * 100).toFixed(1)}%</strong></div>
              <div><span>Precisión</span><strong>{(result.classification.metrics.precision * 100).toFixed(1)}%</strong></div>
              <div><span>ROC-AUC</span><strong>{result.classification.metrics.rocAuc.toFixed(3)}</strong></div>
            </div>
          </div>}
        </section>
      </div>}
    </section>
  );
};

export default ModelTrainingPanel;
