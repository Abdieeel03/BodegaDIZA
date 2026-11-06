import { NavLink } from 'react-router-dom';

export const Sidebar = () => {
  const menuItems = [
    { to: '/', label: '📊 Dashboard', end: true },
    { to: '/inventario', label: '📦 Inventario' },
    { to: '/conexion-api', label: '⚡ Estado API & JWT' },
  ];

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? 'sidebar-link active' : 'sidebar-link'
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
