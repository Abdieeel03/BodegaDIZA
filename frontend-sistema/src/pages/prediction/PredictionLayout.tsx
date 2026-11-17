import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import './prediction-live.css';

// La navegación de las secciones está en Sidebar (y en su selector móvil).
// No duplicamos los enlaces sobre el encabezado de cada página.
export function PredictionLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);
  return <div className="prediction-module"><Outlet /></div>;
}
