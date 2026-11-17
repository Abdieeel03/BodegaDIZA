import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, type TrainingResult } from '../../types';
import { mlService } from '../../services/mlService';
import { Button } from '../../components/ui';
import './predictions-ml.css';

type ModelTrainingPanelProps = {
  onCompleted?: () => void;
};

// Mantener el entrenamiento real: POST /ml/trainings con los datos registrados.
// Este panel no carga archivos ni modifica el stock de forma directa.
export const ModelTrainingPanel = ({ onCompleted }: ModelTrainingPanelProps) => {
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resultOrigin, setResultOrigin] = useState<'latest' | 'new'>('latest');
  const trainingRequested = useRef(false);

  // Mostrar las métricas del último entrenamiento al abrir la pantalla,
  // sin exigir un nuevo entrenamiento ni un clic para desplegarlas.
  useEffect(() => {
    let active = true;
    void mlService.getLatestTraining()
      .then(last => {
        if (active && !trainingRequested.current) {
          setResult(last);
          setResultOrigin('latest');
        }
      })
      .catch(() => { /* Puede que todavía no exista ningún entrenamiento. */ });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    trainingRequested.current = true;
    setError(null);
    setResult(null);
    setIsLoading(true);
    try {
      const completed = await mlService.train();
      setResult(completed);
      setResultOrigin('new');
      onCompleted?.(); // Refrescar información si una vista padre lo necesita.
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : requestError instanceof Error ? requestError.message : 'No fue posible actualizar el modelo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="diza-model-panel" id="diza-model-training-panel" aria-labelledby="diza-model-training-title">
      <div className="diza-model-panel-heading">
        <div>
          <span className="diza-model-eyebrow">MODELO DE DEMANDA</span>
          <h2 id="diza-model-training-title">Generar predicciones</h2>
          <p>Utiliza el historial de ventas y el inventario registrados.</p>
        </div>
        <span className="diza-model-horizon">Horizonte: 7 días</span>
      </div>

      <form onSubmit={handleSubmit} className="diza-model-action-row">
        <p>No requiere archivos ni modifica el stock. El entrenamiento puede tardar unos minutos.</p>
        <Button type="submit" loading={isLoading} disabled={isLoading}>
          {isLoading ? 'Generando predicciones...' : 'Generar nuevas predicciones'}
        </Button>
      </form>

      {isLoading && <p className="diza-model-info" role="status">Entrenando el modelo con los datos registrados…</p>}
      {error && <div className="diza-model-error" role="alert">{error} Revisa la conexión con el servicio ML e inténtalo nuevamente.</div>}

      {result && <div className="diza-model-result" role="status">
        <div className="diza-model-result-heading">
          <div>
            <h3>{resultOrigin === 'new' ? 'Predicciones actualizadas' : 'Último entrenamiento disponible'}</h3>
            <p>{resultOrigin === 'new'
              ? 'Entrenamiento completado. Vuelve al Resumen para consultar los nuevos pronósticos.'
              : 'Estas métricas corresponden al último entrenamiento guardado.'}</p>
          </div>
          <span className="diza-model-success">Modelo listo</span>
        </div>
        <div className="diza-model-kpis">
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
