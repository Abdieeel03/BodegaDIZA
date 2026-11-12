import { useState, type FormEvent } from 'react';
import { ApiError, type TrainingResult } from '../../types';
import { mlService } from '../../services/mlService';

export const PredictionsPage = () => {
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [productsFile, setProductsFile] = useState<File | null>(null);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!salesFile || !productsFile) {
      setError('Selecciona el CSV de ventas y el CSV de productos.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      setResult(await mlService.train(salesFile, productsFile));
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
          <p>Entrena el modelo con ventas e inventario para estimar la demanda de los próximos 7 días.</p>
        </div>
        <div className="prediction-hero-stat"><span>Horizonte</span><strong>7 días</strong><small>Demanda y reposición</small></div>
      </div>

      <form className="prediction-workspace" onSubmit={handleSubmit}>
        <div className="prediction-upload-grid">
          <label className={`prediction-upload${salesFile ? ' is-ready' : ''}`} htmlFor="sales-file">
            <span className="prediction-upload-icon">↗</span>
            <span className="prediction-upload-copy"><strong>Historial de ventas</strong><small>{salesFile ? salesFile.name : 'CSV con ventas diarias por producto'}</small></span>
            <input id="sales-file" type="file" accept=".csv,text/csv" onChange={(event) => setSalesFile(event.target.files?.[0] || null)} />
          </label>
          <label className={`prediction-upload${productsFile ? ' is-ready' : ''}`} htmlFor="products-file">
            <span className="prediction-upload-icon">▣</span>
            <span className="prediction-upload-copy"><strong>Inventario actual</strong><small>{productsFile ? productsFile.name : 'CSV con stock y stock mínimo'}</small></span>
            <input id="products-file" type="file" accept=".csv,text/csv" onChange={(event) => setProductsFile(event.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="prediction-submit-row">
          <div><strong>Modelo de demanda</strong><span>Compara baseline, regresión y bosque aleatorio.</span></div>
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
        </section>
      )}
    </div>
  );
};

export default PredictionsPage;
