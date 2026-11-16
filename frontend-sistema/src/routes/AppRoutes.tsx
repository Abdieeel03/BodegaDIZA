import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ApiStatusPage } from '../pages/api-status/ApiStatusPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { DemoDataPage } from '../pages/demo/DemoDataPage';
import { InventoryMovementsPage } from '../pages/inventory/InventoryMovementsPage';
import { InventoryPage } from '../pages/inventory/InventoryPage';
import { BulkInventoryCsvPage } from '../pages/inventory/bulk/BulkInventoryCsvPage';
import { NotFoundPage } from '../pages/not-found/NotFoundPage';
import { PredictionPage } from '../pages/prediction/PredictionPage';
import { PredictionsPage } from '../pages/predictions/PredictionsPage';
import { ProductCreatePage } from '../pages/product/ProductCreatePage';
import { SalesPage } from '../pages/sales/SalesPage';
import { AuthLayout } from '../layouts/AuthLayout';
import { MainLayout } from '../layouts/MainLayout';
import { ProtectedRoute } from './ProtectedRoute';

export const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AuthLayout />}><Route path="/login" element={<LoginPage />} /></Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/ventas" element={<SalesPage />} />
          <Route path="/datos-prueba" element={<DemoDataPage />} />
          <Route path="/inventario" element={<InventoryPage />} />
          <Route path="/inventario/agregar" element={<ProductCreatePage />} />
          <Route path="/inventario/movimientos" element={<InventoryMovementsPage />} />
          <Route path="/inventario/carga-masiva" element={<BulkInventoryCsvPage />} />
          <Route path="/predicciones" element={<PredictionsPage />} />
          <Route path="/predicciones-ml" element={<Navigate to="/predicciones" replace />} />
          <Route path="/prediccion-demanda" element={<PredictionPage />} />
          <Route path="/conexion-api" element={<ApiStatusPage />} />
        </Route>
      </Route>
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;
