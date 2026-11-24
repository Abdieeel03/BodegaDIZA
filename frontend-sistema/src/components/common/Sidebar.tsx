import { Link, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { PredictionMenu } from './PredictionMenu';
import { predictionSections } from '../../pages/prediction/predictionNavigation';
import { UiIcon, type UiIconName } from './UiIcon';

type MenuItem = {
  label: string;
  mobileLabel: string;
  icon: UiIconName;
  to?: string;
};

// Mantener todos los destinos existentes. Los apartados pendientes permanecen
// visibles en escritorio, pero no ocupan un espacio en la navegación móvil.
const menuItems: MenuItem[] = [
  { to: '/', label: 'Inicio', mobileLabel: 'Inicio', icon: 'home' },
  { to: '/ventas', label: 'Ventas', mobileLabel: 'Ventas', icon: 'sales' },
  { to: '/inventario', label: 'Inventario', mobileLabel: 'Inventario', icon: 'inventory' },
  {
    to: '/prediccion-demanda',
    label: 'Predicción de demanda',
    mobileLabel: 'Predicción',
    icon: 'prediction',
  },
  { label: 'Próximos a vencer', mobileLabel: 'Vence', icon: 'calendar' },
  { to: '/alertas', label: 'Alertas', mobileLabel: 'Alertas', icon: 'warning' },
];

const mobileItems = menuItems.filter(
  (item): item is MenuItem & { to: string } => Boolean(item.to),
);

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
  const { pathname } = useLocation();
  const predictionActive = pathname === '/prediccion-demanda' || pathname.startsWith('/prediccion-demanda/');
  const [mobileState, setMobileState] = useState({ open: false, path: pathname });
  const mobileOpen = mobileState.open && mobileState.path === pathname;

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileState({ open: false, path: pathname });
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen, pathname]);

  return (
  <>
    <aside className="diza-sidebar" aria-label="Menú principal">
      <div className="diza-sidebar-header">
        <Link
          className="diza-sidebar-brand"
          to="/"
          aria-label={collapsed ? 'BodegaDIZA, ir al inicio' : undefined}
          title="Ir al inicio"
        >
          <span className="diza-brand-monogram" aria-hidden="true">BD</span>
          <span className="diza-sidebar-brand-text">
            <strong>BodegaDIZA</strong>
            <small>Tu bodega, mejor gestionada</small>
          </span>
        </Link>
        <button
          type="button"
          className="diza-toggle-sidebar"
          aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          aria-expanded={!collapsed}
          onClick={onToggle}
          title={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
        >
          <UiIcon name="chevron" size={19} className={collapsed ? '' : 'diza-chevron-left'} />
        </button>
      </div>

      <nav className="diza-sidebar-nav" aria-label="Secciones del sistema">
        {menuItems.map((item) => {
          if (item.to === '/prediccion-demanda') {
            return <PredictionMenu key={item.label} collapsed={collapsed} onToggle={onToggle} />;
          }

          if (item.to) {
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/'}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `diza-sidebar-link${isActive ? ' is-active' : ''}`
                }
              >
                <UiIcon name={item.icon} size={20} />
                <span className="diza-nav-label">{item.label}</span>
              </NavLink>
            );
          }

          return (
            <span
              key={item.label}
              className="diza-sidebar-link diza-sidebar-link--disabled"
              aria-disabled="true"
              aria-label={collapsed ? `${item.label}: disponible próximamente` : undefined}
              title={`${item.label}: disponible próximamente`}
            >
              <UiIcon name={item.icon} size={20} />
              <span className="diza-nav-label">{item.label}</span>
            </span>
          );
        })}
      </nav>

      <div className="diza-sidebar-footer" title="BodegaDIZA · Panel de gestión">
        <UiIcon name="store" size={20} />
        <span className="diza-sidebar-footer-text">Panel de gestión</span>
      </div>
    </aside>

    <nav className="diza-mobile-nav" aria-label="Navegación principal móvil">
      {mobileItems.map((item) => item.to === '/prediccion-demanda' ? (
        <button
          key={item.label}
          type="button"
          className={`diza-mobile-link${predictionActive ? ' is-active' : ''}`}
          aria-expanded={mobileOpen}
          aria-controls={mobileOpen ? "diza-mobile-prediction-panel" : undefined}
          onClick={() => setMobileState({ open: !mobileOpen, path: pathname })}
        >
          <UiIcon name={item.icon} size={22} />
          <span>{item.mobileLabel}</span>
        </button>
      ) : (
        <NavLink
          key={item.label}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `diza-mobile-link${isActive ? ' is-active' : ''}`
          }
        >
          <UiIcon name={item.icon} size={22} />
          <span>{item.mobileLabel}</span>
        </NavLink>
      ))}
    </nav>
    {mobileOpen && <>
      <button type="button" className="diza-mobile-prediction-backdrop"
        aria-label="Cerrar secciones de Predicción"
        onClick={() => setMobileState({ open: false, path: pathname })} />
      <nav id="diza-mobile-prediction-panel" className="diza-mobile-prediction-panel"
        aria-label="Secciones de Predicción de demanda">
        <strong>Predicción de demanda</strong>
        {predictionSections.map((section) => (
          <NavLink key={section.to} to={section.to} end
            onClick={() => setMobileState({ open: false, path: pathname })}>
            {section.label}
          </NavLink>
        ))}
      </nav>
    </>}
  </>
  );
};

export default Sidebar;
