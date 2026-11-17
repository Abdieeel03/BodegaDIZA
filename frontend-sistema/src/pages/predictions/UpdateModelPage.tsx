import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui';
import { ModelTrainingPanel } from './PredictionsPage';
import './predictions-ml.css';

/** Pantalla independiente: accesible desde el botón del Resumen, no desde el Sidebar. */
export function UpdateModelPage() {
  return (
    <main className="diza-model-screen">
      <Link className="diza-model-back" to="/prediccion-demanda">
        <span aria-hidden="true">←</span> Volver al resumen de predicción
      </Link>
      <PageHeader
        title="Actualizar modelo"
        description="Genera una nueva predicción con los datos de tu bodega."
      />
      <ModelTrainingPanel />
    </main>
  );
}
