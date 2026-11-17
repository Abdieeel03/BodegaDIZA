import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UiIcon } from './UiIcon';

const titulos: Record<string, string> = {
  '/': 'Inicio',
  '/inventario': 'Inventario',
  '/prediccion-demanda': 'Predicción de demanda',
  '/ventas': 'Ventas',
  '/ventas/importar-historico': 'Importar histórico',
  '/inventario/agregar': 'Nuevo producto',
  '/inventario/movimientos': 'Movimientos de inventario',
  '/inventario/carga-masiva': 'Importar productos',
  '/prediccion-demanda/producto': 'Por producto',
  '/prediccion-demanda/reposicion': 'Reposición',
  '/prediccion-demanda/compras': 'Planificar compras',
  '/prediccion-demanda/actualizar-modelo': 'Actualizar modelo',
};

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    // Un menú abierto en una página no debe quedar abierto tras navegar.
    if (menuRef.current) menuRef.current.open = false;
  }, [pathname]);

  const nombre = user?.nombre?.trim() || 'Usuario';
  const iniciales = nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join('')
    .toUpperCase();
  const titulo = titulos[pathname] || 'Panel de gestión';
  const parentPath = ['/ventas', '/inventario', '/prediccion-demanda']
    .find((path) => pathname.startsWith(`${path}/`));
  const rol = user?.rol === 'ADMIN' ? 'Administrador' : user?.rol === 'CAJERO' ? 'Cajero' : 'Usuario';

  return (
    <header className="diza-topbar">
      <div className="diza-topbar-left">
        <Link className="diza-mobile-brand" to="/" aria-label="BodegaDIZA, ir al inicio">
          <span className="diza-brand-monogram" aria-hidden="true">BD</span>
          <span className="diza-mobile-brand-copy">
            <strong>BodegaDIZA</strong>
            <small>{titulo}</small>
          </span>
        </Link>
        <nav className="diza-breadcrumb" aria-label="Ruta de navegación">
          <Link to="/">BodegaDIZA</Link>
          <span className="diza-breadcrumb-separator" aria-hidden="true">/</span>
          {parentPath && (
            <>
              <Link to={parentPath}>{titulos[parentPath]}</Link>
              <span className="diza-breadcrumb-separator" aria-hidden="true">/</span>
            </>
          )}
          <span aria-current="page">{titulo}</span>
        </nav>
      </div>

      <div className="diza-topbar-actions">
        <details className="diza-user-menu" ref={menuRef}>
          <summary aria-label={`Opciones del usuario ${nombre}`} title="Opciones de usuario">
            <span className="diza-user-details">
              <strong>{nombre}</strong>
              <small>{rol}</small>
            </span>
            <span className="diza-avatar" aria-hidden="true">{iniciales || 'U'}</span>
            <UiIcon name="chevron" size={15} className="diza-user-chevron" />
          </summary>
          <div className="diza-user-popover">
            <span className="diza-user-popover-name">{nombre}</span>
            <span className="diza-user-popover-role">{rol}</span>
            <button type="button" onClick={logout}>
              <UiIcon name="logout" size={18} />
              Cerrar sesión
            </button>
          </div>
        </details>
      </div>
    </header>
  );
};

export default Navbar;
