import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { UiIcon } from './UiIcon';
import { predictionSections } from '../../pages/prediction/predictionNavigation';

type PredictionMenuProps = { collapsed: boolean; onToggle: () => void };

// Al entrar en Predicción, las secciones se muestran en el Sidebar.
// La navegación horizontal dentro de la página fue retirada.
export function PredictionMenu({ collapsed, onToggle }: PredictionMenuProps) {
  const { pathname } = useLocation();
  const active = pathname === '/prediccion-demanda' || pathname.startsWith('/prediccion-demanda/');
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const open = !collapsed && (manualExpanded ?? active);

  return (
    <div className="prediction-menu">
      <div className="prediction-menu-row">
        <Link
          to="/prediccion-demanda"
          className={`diza-sidebar-link${active ? ' is-active' : ''}`}
          aria-label={collapsed ? 'Predicción de demanda' : undefined}
          aria-current={pathname === '/prediccion-demanda' ? 'page' : undefined}
          title={collapsed ? 'Predicción de demanda' : undefined}
          onClick={() => {
            if (collapsed) onToggle();
          }}
        >
          <UiIcon name="prediction" size={20} />
          <span className="diza-nav-label">Predicción de demanda</span>
        </Link>
        {!collapsed && (
          <button
            type="button"
            className="prediction-menu-toggle"
            aria-expanded={open}
            aria-controls="prediction-submenu"
            aria-label={open ? 'Ocultar secciones de predicción' : 'Mostrar secciones de predicción'}
            onClick={() => setManualExpanded((previous) => !(previous ?? active))}
            title={open ? 'Ocultar secciones' : 'Mostrar secciones'}
          >
            <UiIcon name="chevron" size={17} className={open ? 'prediction-chevron-open' : ''} />
          </button>
        )}
      </div>
      {!collapsed && (
        <nav
          id="prediction-submenu"
          className="prediction-submenu"
          aria-label="Secciones de predicción de demanda"
          hidden={!open}
        >
          {predictionSections.map((section) => (
            <NavLink key={section.to} to={section.to} end>
              {section.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
