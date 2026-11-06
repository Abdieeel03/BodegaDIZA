import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';

// Páginas
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { InventoryPage } from '../pages/inventory/InventoryPage';
import { ApiStatusPage } from '../pages/api-status/ApiStatusPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas de Autenticación */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Rutas de la Aplicación (con Layout Principal) */}
        <Route element={<MainLayout />}>
          {/* Páginas accesibles para testing y desarrollo */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/conexion-api" element={<ApiStatusPage />} />

          {/* Rutas protegidas que requieren autenticación */}
          <Route element={<ProtectedRoute />}>
            <Route path="/inventario" element={<InventoryPage />} />
          </Route>
        </Route>

        {/* Página 404 y redirecciones */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
