import { Outlet, Link } from 'react-router-dom';

export const AuthLayout = () => {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" className="brand-logo">
            🍷 Bodega<strong>DIZA</strong>
          </Link>
          <p className="auth-subtitle">Acceso seguro al sistema</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
