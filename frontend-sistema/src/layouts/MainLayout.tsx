import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '../components/common/Navbar';
import { Sidebar } from '../components/common/Sidebar';
import './diza-layout.css';

// Diseño compartido de las páginas protegidas. No cambia la autenticación.
export const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    // Al cambiar de módulo, la siguiente pantalla comienza desde arriba.
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className={`diza-shell${collapsed ? ' is-collapsed' : ''}`}>
      <a href="#diza-main" className="diza-skip-link">Saltar al contenido</a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
      <div className="diza-workspace">
        <Navbar />
        <main id="diza-main" className="diza-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
