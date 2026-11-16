import { Link, NavLink } from 'react-router-dom';
import { UiIcon, type UiIconName } from './UiIcon';

type MenuItem = {
  label: string;
  mobileLabel: string;
  icon: UiIconName;
  to?: string;
};

// Solo habilitamos las páginas que ya existen. Los otros módulos quedan visibles
// como referencia visual, sin enviar al usuario a una ruta 404.
const menuItems: MenuItem[] = [
  { to: '/', label: 'Inicio', mobileLabel: 'Inicio', icon: 'home' },
  { to: 'ventas', label: 'Ventas', mobileLabel: 'Ventas', icon: 'sales' },
  { to: '/inventario', label: 'Inventario', mobileLabel: 'Inventario', icon: 'inventory' },
  {
    to: '/prediccion-demanda',
    label: 'Predicción de demanda',
    mobileLabel: 'Predicción',
    icon: 'prediction',
  },
  {
    to: '/predicciones-ml',
    label: 'Entrenamiento ML',
    mobileLabel: 'Entrenar ML',
    icon: 'prediction',
  },
  { label: 'Próximos a vencer', mobileLabel: 'Vence', icon: 'calendar' },
  { label: 'Alertas', mobileLabel: 'Alertas', icon: 'warning' },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => (
  <>
    <aside className="diza-sidebar" aria-label="Menú principal">
      <div className="diza-sidebar-header">
        <Link className="diza-sidebar-brand" to="/" title="Ir al inicio">
          <span className="diza-brand-monogram">BD</span>
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
          <UiIcon name="chevron" size={17} className={collapsed ? '' : 'diza-chevron-left'} />
        </button>
      </div>

      <nav className="diza-sidebar-nav" aria-label="Secciones del sistema">
        {menuItems.map((item) =>
          item.to ? (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `diza-sidebar-link${isActive ? ' is-active' : ''}`
              }
            >
              <UiIcon name={item.icon} size={19} />
              <span className="diza-nav-label">{item.label}</span>
            </NavLink>
          ) : (
            <span
              key={item.label}
              className="diza-sidebar-link diza-sidebar-link--disabled"
              aria-disabled="true"
              title={`${item.label}: disponible próximamente`}
            >
              <UiIcon name={item.icon} size={19} />
              <span className="diza-nav-label">{item.label}</span>
            </span>
          ),
        )}
      </nav>

      <div className="diza-sidebar-footer" title="Bodega DIZA · Panel de gestión">
        <UiIcon name="store" size={18} />
        <span className="diza-sidebar-footer-text">Panel de gestión</span>
      </div>
    </aside>

    <nav className="diza-mobile-nav" aria-label="Navegación inferior">
      {menuItems.map((item) =>
        item.to ? (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `diza-mobile-link${isActive ? ' is-active' : ''}`
            }
          >
            <UiIcon name={item.icon} size={19} />
            <span>{item.mobileLabel}</span>
          </NavLink>
        ) : (
          <span
            key={item.label}
            className="diza-mobile-link diza-mobile-link--disabled"
            aria-disabled="true"
            title={`${item.label}: disponible próximamente`}
          >
            <UiIcon name={item.icon} size={19} />
            <span>{item.mobileLabel}</span>
          </span>
        ),
      )}
    </nav>
  </>
);

export default Sidebar;
