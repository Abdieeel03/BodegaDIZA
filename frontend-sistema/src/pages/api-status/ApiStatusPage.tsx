import { useAuth } from '../../hooks/useAuth';

export const ApiStatusPage = () => {
  const { user } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Estado de sesión</h1>
        <p>La sesión actual está autenticada mediante un JWT mantenido únicamente en memoria.</p>
      </div>

      <div className="card">
        <h3>Usuario autenticado</h3>
        <p><strong>Nombre:</strong> {user?.nombre}</p>
        <p><strong>Correo:</strong> {user?.email}</p>
        <p><strong>Rol:</strong> {user?.rol}</p>
      </div>
    </div>
  );
};

export default ApiStatusPage;
