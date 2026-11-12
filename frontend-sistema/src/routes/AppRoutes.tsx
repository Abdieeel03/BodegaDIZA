
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { MainLayout } from '../layouts/MainLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';

import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { SalesPage } from '../pages/sales/SalesPage';
import { InventoryPage } from '../pages/inventory/InventoryPage';
import { ApiStatusPage } from '../pages/api-status/ApiStatusPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';
import { PredictionsPage } from '../pages/predictions/PredictionsPage';

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Rutas que requieren autenticación */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/ventas"
              element={<SalesPage />}
            />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/predicciones" element={<PredictionsPage />} />
            <Route path="/prediccion-demanda" element={<Navigate to="/predicciones" replace />} />
            <Route
              path="/conexion-api"
              element={<ApiStatusPage />}
            />
          </Route>
        </Route>

        {/* Página no encontrada */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;

