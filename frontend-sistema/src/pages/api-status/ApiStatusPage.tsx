import { useAuth } from '../../hooks/useAuth';

export const ApiStatusPage = () => {
  const { user } = useAuth();

  return (
    <div className="page-container session-page">
      <div className="page-header">
        <span className="eyebrow">SEGURIDAD</span>
        <h1>Estado de sesión</h1>
        <p>La sesión actual está autenticada mediante un JWT mantenido únicamente en memoria.</p>
      </div>

      <div className="card session-card">
        <span className="prediction-success">Sesión protegida</span>
        <h3>Usuario autenticado</h3>
        <dl>
          <div><dt>Nombre</dt><dd>{user?.nombre}</dd></div>
          <div><dt>Correo</dt><dd>{user?.email}</dd></div>
          <div><dt>Rol</dt><dd>{user?.rol}</dd></div>
        </dl>
      </div>
    </div>
  );
};

export default ApiStatusPage;
