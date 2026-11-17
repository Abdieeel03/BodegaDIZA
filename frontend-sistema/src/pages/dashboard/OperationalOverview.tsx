import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { productosOperativos, ventasOperativas, type ProductoOperativo, type VentaOperativa } from '../../services/testDataService';
import { stockMovements, type StockMovement } from '../../services/periodReportService';
import { Button, StatCard } from '../../components/ui';
import { PeriodControls, dateInRange, formatMoney, formatNumber, getPeriodRange, todayLocal, type PeriodMode } from '../../components/period/PeriodControls';

type Available = { sales: boolean; products: boolean; movements: boolean };

/** Resumen de operaciones reales: no mezcla ventas registradas con históricos CSV. */
export const OperationalOverview = () => {
  const [period, setPeriod] = useState<PeriodMode>('mes');
  const [anchor, setAnchor] = useState(todayLocal());
  const [sales, setSales] = useState<VentaOperativa[]>([]);
  const [products, setProducts] = useState<ProductoOperativo[]>([]);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [available, setAvailable] = useState<Available>({ sales: false, products: false, movements: false });
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.allSettled([ventasOperativas(), productosOperativos(), stockMovements()]).then(results => {
      if (!active) return;
      const [salesResult, productsResult, movementsResult] = results;
      setAvailable({ sales: salesResult.status === 'fulfilled', products: productsResult.status === 'fulfilled', movements: movementsResult.status === 'fulfilled' });
      setSales(salesResult.status === 'fulfilled' ? salesResult.value : []);
      setProducts(productsResult.status === 'fulfilled' ? productsResult.value : []);
      setMoves(movementsResult.status === 'fulfilled' ? movementsResult.value : []);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const range = useMemo(() => getPeriodRange(period, anchor), [period, anchor]);
  const salesInRange = sales.filter(item => dateInRange(item.fecha, range));
  const movesInRange = moves.filter(item => dateInRange(item.fecha, range));
  const totalSales = salesInRange.reduce((sum, item) => sum + Number(item.total), 0);
  const withoutStock = products.filter(item => item.activo && item.stockTotal <= 0).length;
  const incoming = movesInRange.filter(item => item.tipo === 'ENTRADA').reduce((sum, item) => sum + Number(item.cantidad), 0);
  const outgoing = movesInRange.filter(item => item.tipo === 'SALIDA').reduce((sum, item) => sum + Number(item.cantidad), 0);
  const unavailable = [!available.sales && 'ventas', !available.products && 'productos', !available.movements && 'movimientos'].filter(Boolean);

  return (
    <section className="diza-dashboard-section diza-dashboard-operational" aria-labelledby="diza-operational-title">
      <div className="diza-dashboard-section-heading">
        <div>
          <h2 id="diza-operational-title">Resumen de ventas e inventario</h2>
          <p>Ventas e inventario registrados en el sistema.</p>
        </div>
        <Button variant="secondary" size="sm" loading={loading} onClick={() => setRefresh(value => value + 1)}>Actualizar operaciones</Button>
      </div>
      <div className="diza-dashboard-operational-content">
        <PeriodControls mode={period} setMode={setPeriod} anchor={anchor} setAnchor={setAnchor} />
        {!loading && unavailable.length > 0 && (
          <p role="status" className="diza-dashboard-notice">
            No fue posible consultar {unavailable.join(', ')}. Los indicadores afectados aparecen sin valor; los demás siguen disponibles.
          </p>
        )}
        <div className="diza-dashboard-operational-stats" aria-label="Indicadores operativos del período">
          <StatCard label="Tickets del período" value={loading ? 'Cargando...' : available.sales ? salesInRange.length : '—'} />
          <StatCard label="Ventas registradas" value={loading ? 'Cargando...' : available.sales ? formatMoney(totalSales) : '—'} />
          <StatCard label="Entradas del período" value={loading ? 'Cargando...' : available.movements ? formatNumber(incoming) : '—'} />
          <StatCard label="Salidas del período" value={loading ? 'Cargando...' : available.movements ? formatNumber(outgoing) : '—'} />
        </div>
        <div className="diza-dashboard-operational-footer">
          <span>{loading ? 'Consultando catálogo...' : available.products
            ? <>Productos en catálogo: <strong>{products.length}</strong> · Sin stock actual: <strong>{withoutStock}</strong></>
            : 'Catálogo no disponible'}</span>
          <div className="diza-dashboard-operational-links">
            <Link to="/ventas">Ver ventas <span aria-hidden="true">→</span></Link>
            <Link to="/inventario/movimientos">Ver movimientos <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OperationalOverview;
