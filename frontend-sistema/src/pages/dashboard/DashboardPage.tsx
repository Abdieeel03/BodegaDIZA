import { useAuth } from '../../hooks/useAuth';

export const DashboardPage = () => {
  const { user } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📊 Panel Principal</h1>
        <p>Bienvenido de nuevo, <strong>{user?.nombre || 'Administrador'}</strong>.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Productos en Stock</div>
          <div className="stat-value">1,482</div>
          <span className="stat-indicator positive">+12% vs mes anterior</span>
        </div>
        <div className="stat-card">
          <div className="stat-title">Ventas Hoy</div>
          <div className="stat-value">S/. 3,250.00</div>
          <span className="stat-indicator positive">28 transacciones</span>
        </div>
        <div className="stat-card">
          <div className="stat-title">Alertas de Stock Bajo</div>
          <div className="stat-value warning">5</div>
          <span className="stat-indicator warning">Requieren reposición</span>
        </div>
        <div className="stat-card">
          <div className="stat-title">Sesión JWT</div>
          <div className="stat-value">Activa</div>
          <span className="stat-indicator info">Rol: {user?.rol || 'ADMIN'}</span>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
