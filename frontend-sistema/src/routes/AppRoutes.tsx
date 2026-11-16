
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { MainLayout } from '../layouts/MainLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';

import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { SalesPage } from '../pages/sales/SalesPage';
import { DemoDataPage } from '../pages/demo/DemoDataPage';
import { InventoryPage } from '../pages/inventory/InventoryPage';
import { ProductCreatePage } from '../pages/product/ProductCreatePage';
import { InventoryMovementsPage } from '../pages/inventory/InventoryMovementsPage';
import { BulkInventoryCsvPage } from '../pages/inventory/bulk/BulkInventoryCsvPage';
import { PredictionPage } from '../pages/prediction/PredictionPage';
import { ApiStatusPage } from '../pages/api-status/ApiStatusPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { PredictionsPage } from '../pages/predictions/PredictionsPage';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';

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
            <Route path="/datos-prueba" element={<DemoDataPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/inventario/agregar" element={<ProductCreatePage />} />
            <Route path="/inventario/movimientos" element={<InventoryMovementsPage />} />
            <Route path="/inventario/carga-masiva" element={<BulkInventoryCsvPage />} />
	    <Route path="/predicciones-ml" element={<PredictionsPage />} />
            <Route
              path="/prediccion-demanda"
              element={<PredictionPage />}
            />
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

