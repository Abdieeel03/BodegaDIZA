import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UiIcon } from './UiIcon';

const titulos: Record<string, string> = {
  '/': 'Inicio',
  '/inventario': 'Inventario',
  '/prediccion-demanda': 'Predicción de demanda',
  '/conexion-api': 'Estado API y JWT',
};

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const nombre = user?.nombre?.trim() || 'Usuario';
  const iniciales = nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join('')
    .toUpperCase();
  const titulo = titulos[pathname] || 'Panel de gestión';

  return (
    <header className="diza-topbar">
      <div className="diza-topbar-left">
        <Link className="diza-mobile-brand" to="/" aria-label="BodegaDIZA, ir al inicio">
          <span className="diza-brand-monogram">BD</span>
          <span>
            <strong>BodegaDIZA</strong>
            <small>Tu bodega, mejor gestionada</small>
          </span>
        </Link>
        <nav className="diza-breadcrumb" aria-label="Ruta de navegación">
          <Link to="/">BodegaDIZA</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{titulo}</span>
        </nav>
      </div>

      <div className="diza-topbar-actions">
        <span className="diza-bell-disabled" title="Notificaciones: disponible próximamente" aria-label="Notificaciones no disponibles">
          <UiIcon name="bell" size={19} />
        </span>
        <details className="diza-user-menu">
          <summary aria-label={`Opciones del usuario ${nombre}`} title="Opciones de usuario">
            <span className="diza-user-details">
              <strong>{nombre}</strong>
              <small>{user?.rol || 'Usuario'}</small>
            </span>
            <span className="diza-avatar" aria-hidden="true">{iniciales || 'U'}</span>
          </summary>
          <div className="diza-user-popover">
            <span className="diza-user-popover-name">{nombre}</span>
            <span className="diza-user-popover-role">{user?.rol || 'Usuario'}</span>
            <button type="button" onClick={logout}>
              <UiIcon name="logout" size={16} />
              Cerrar sesión
            </button>
          </div>
        </details>
      </div>
    </header>
  );
};

export default Navbar;
