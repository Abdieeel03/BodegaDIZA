import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="brand-logo">
          🍷 Bodega<strong>DIZA</strong>
        </Link>
        <span className="system-tag">Sistema de Gestión</span>
      </div>

      <div className="navbar-actions">
        {isAuthenticated ? (
          <div className="user-profile">
            <span className="user-name">👤 {user?.nombre || 'Usuario'}</span>
            <span className="user-badge">{user?.rol || 'USER'}</span>
            <button type="button" onClick={logout} className="btn-logout">
              Cerrar Sesión
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn-login">
            Iniciar Sesión
          </Link>
        )}
      </div>
    </header>
  );
};

export default Navbar;
