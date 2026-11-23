
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { MainLayout } from '../layouts/MainLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';

import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { SalesPage } from '../pages/sales/SalesPage';
import { InventoryPage } from '../pages/inventory/InventoryPage';
import { ProductCreatePage } from '../pages/product/ProductCreatePage';
import { InventoryMovementsPage } from '../pages/inventory/InventoryMovementsPage';
import { BulkInventoryCsvPage } from '../pages/inventory/bulk/BulkInventoryCsvPage';
import { PredictionLayout } from '../pages/prediction/PredictionLayout';
import { PredictionPage } from '../pages/prediction/PredictionPage';
import { UpdateModelPage } from '../pages/predictions/UpdateModelPage';
import { AlertsPage } from '../pages/alerts/AlertsPage';
import { LoginPage } from '../pages/auth/LoginPage';
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
            <Route path="/ventas/importar-historico" element={<Navigate to="/ventas" replace />} />
            <Route path="/datos-prueba" element={<Navigate to="/ventas" replace />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/inventario/agregar" element={<ProductCreatePage />} />
            <Route path="/inventario/movimientos" element={<InventoryMovementsPage />} />
            <Route path="/inventario/carga-masiva" element={<BulkInventoryCsvPage />} />

            <Route path="/alertas" element={<AlertsPage />} />
	    
            <Route path="/predicciones-ml" element={<Navigate to="/prediccion-demanda" replace />} />
            <Route path="/prediccion-demanda" element={<PredictionLayout />}>
              <Route index element={<PredictionPage view="summary" />} />
              <Route path="producto" element={<PredictionPage view="product" />} />
              <Route path="reposicion" element={<PredictionPage view="replenishment" />} />
              <Route path="compras" element={<PredictionPage view="purchases" />} />
              <Route path="actualizar-modelo" element={<UpdateModelPage />} />
            </Route>

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

