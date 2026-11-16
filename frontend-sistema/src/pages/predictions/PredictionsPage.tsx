import { useState, type FormEvent } from 'react';
import { ApiError, type TrainingResult } from '../../types';
import { mlService } from '../../services/mlService';
import './predictions-ml.css';

export const PredictionsPage = () => {
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      setResult(await mlService.train());
    } catch (requestError: unknown) {
      setError(requestError instanceof ApiError ? requestError.message : 'No fue posible entrenar el modelo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="prediction-page">
      <div className="prediction-hero">
        <div>
          <span className="eyebrow">INTELIGENCIA DE INVENTARIO</span>
          <h1>Anticipa lo que tu bodega necesitará.</h1>
          <p>Entrena el modelo directamente con las ventas e inventario registrados en PostgreSQL para estimar la demanda de los próximos 7 días.</p>
        </div>
        <div className="prediction-hero-stat"><span>Horizonte</span><strong>7 días</strong><small>Demanda y reposición</small></div>
      </div>

      <form className="prediction-workspace" onSubmit={handleSubmit}>
        <div className="prediction-upload-grid">
          <div className="prediction-upload is-ready">
            <span className="prediction-upload-icon">↗</span>
            <span className="prediction-upload-copy"><strong>Historial de ventas</strong><small>Conectado a la base de datos PostgreSQL</small></span>
          </div>
          <div className="prediction-upload is-ready">
            <span className="prediction-upload-icon">▣</span>
            <span className="prediction-upload-copy"><strong>Inventario actual</strong><small>Productos, lotes y stock mínimo en PostgreSQL</small></span>
          </div>
        </div>
        <div className="prediction-submit-row">
          <div><strong>Modelo de demanda</strong><span>Compara baseline, regresión y árboles de decisión usando datos de la base de datos y ajusta hiperparámetros con Hill Climbing.</span></div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="btn-primary" type="submit" disabled={isLoading}>{isLoading ? 'Entrenando modelo...' : 'Entrenar y generar predicción'}</button>
        </div>
      </form>

      {result && (
        <section className="prediction-result">
          <div className="prediction-result-heading">
            <div><span className="eyebrow">ENTRENAMIENTO COMPLETADO</span><h2>{result.modelName.replaceAll('_', ' ')}</h2></div>
            <span className="prediction-success">Modelo listo</span>
          </div>
          <div className="prediction-metrics">
            <div><span>Productos</span><strong>{result.productsCount}</strong></div>
            <div><span>Observaciones</span><strong>{result.observationsCount}</strong></div>
            <div><span>MAE</span><strong>{result.metrics.mae.toFixed(2)}</strong></div>
            <div><span>RMSE</span><strong>{result.metrics.rmse.toFixed(2)}</strong></div>
            <div><span>WAPE</span><strong>{result.metrics.wape.toFixed(1)}%</strong></div>
          </div>
          {result.hillClimbing && (
            <div className="prediction-submit-row" style={{ marginTop: 16 }}>
              <div>
                <strong>Optimización Hill Climbing</strong>
                <span>
                  {result.hillClimbing.iterations} iteraciones · {result.hillClimbing.evaluatedNeighbors} vecinos evaluados · MAE validación {result.hillClimbing.initialMae.toFixed(4)} → {result.hillClimbing.bestMae.toFixed(4)} ({result.hillClimbing.improved ? 'mejorado' : 'óptimo local inicial'})
                </span>
              </div>
              <small>
                {Object.entries(result.hillClimbing.bestParams).map(([key, val]) => `${key}=${val}`).join(' · ')}
              </small>
            </div>
          )}
          {result.classification && (
            <div style={{ marginTop: 20 }}>
              <div className="prediction-result-heading">
                <div><span className="eyebrow">CLASIFICADOR ML DE RIESGO DE AGOTAMIENTO</span><h2>{result.classification.modelName.replaceAll('_', ' ')}</h2></div>
                <span className="prediction-success">Clasificador listo</span>
              </div>
              <div className="prediction-metrics">
                <div><span>F1-Score</span><strong>{(result.classification.metrics.f1 * 100).toFixed(1)}%</strong></div>
                <div><span>Exactitud (Accuracy)</span><strong>{(result.classification.metrics.accuracy * 100).toFixed(1)}%</strong></div>
                <div><span>Sensibilidad (Recall)</span><strong>{(result.classification.metrics.recall * 100).toFixed(1)}%</strong></div>
                <div><span>Precisión</span><strong>{(result.classification.metrics.precision * 100).toFixed(1)}%</strong></div>
                <div><span>ROC-AUC</span><strong>{result.classification.metrics.rocAuc.toFixed(3)}</strong></div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default PredictionsPage;
