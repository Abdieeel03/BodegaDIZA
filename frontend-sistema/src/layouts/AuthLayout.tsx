import { Outlet, Link } from 'react-router-dom';
import { BrandMark } from '../components/common/BrandMark';

export const AuthLayout = () => {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-header">
          <Link to="/" aria-label="BodegaDIZA">
            <BrandMark />
          </Link>
          <p className="auth-subtitle">Acceso seguro al sistema</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
