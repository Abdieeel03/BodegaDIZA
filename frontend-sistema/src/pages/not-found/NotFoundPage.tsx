import { Link } from 'react-router-dom';

export const NotFoundPage = () => {
  return (
    <div className="not-found-container">
      <h1>404</h1>
      <h2>Página no encontrada</h2>
      <p>La ruta que intentas consultar no existe o ha sido movida.</p>
      <Link to="/" className="btn-primary">
        Volver al Inicio
      </Link>
    </div>
  );
};

export default NotFoundPage;
