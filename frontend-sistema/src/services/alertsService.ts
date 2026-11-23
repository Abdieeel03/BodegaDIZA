import { getExpiryAlerts, getLowStockAlerts, type ExpiringLot, type StockAlert } from './dashboardService';
import { mlService } from './mlService';
import type { ReplenishmentRecommendation } from '../types';

export type OperationalAlert = {
  id: string;
  priority: 'urgent' | 'review';
  title: string;
  message: string;
  actionUrl: string;
};

export type AlertSnapshot = {
  alerts: OperationalAlert[];
  stockAlerts: StockAlert[];
  expiringLots: ExpiringLot[];
  observedAt: string;
};

const numberValue = (value: number) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function buildOperationalAlerts(
  stockAlerts: StockAlert[],
  expiringLots: ExpiringLot[],
  replenishments: ReplenishmentRecommendation[]
): OperationalAlert[] {
  const stockSkus = new Set(stockAlerts.map(alert => alert.sku.trim().toUpperCase()));
  const stock = stockAlerts.map(alert => ({
    id: `stock-${alert.productoId}`,
    priority: 'urgent' as const,
    title: numberValue(alert.stockActual) <= 0 ? `Agotado: ${alert.nombre}` : `Stock bajo: ${alert.nombre}`,
    message: `Disponible: ${numberValue(alert.stockActual).toLocaleString('es-PE')} · Mínimo: ${numberValue(alert.stockMinimo).toLocaleString('es-PE')}`,
    actionUrl: `/inventario/agregar?modo=restock&sku=${encodeURIComponent(alert.sku)}&cantidad=${Math.ceil(numberValue(alert.deficit))}`,
  }));
  const expiry = expiringLots
    .filter(lot => numberValue(lot.cantidadDisponible) > 0)
    .map(lot => ({
      id: `lot-${lot.id}`,
      priority: lot.vencido ? 'urgent' as const : 'review' as const,
      title: lot.vencido ? `Lote vencido: ${lot.productoNombre}` : `Vence en ${lot.diasParaVencer} días: ${lot.productoNombre}`,
      message: `Lote ${lot.codigoLote} · ${numberValue(lot.cantidadDisponible).toLocaleString('es-PE')} unidades disponibles`,
      actionUrl: '/inventario/movimientos',
    }));
  const ml = replenishments
    .filter(item => !stockSkus.has(item.productId.trim().toUpperCase()))
    .filter(item => item.alertStatus === 'ROJO' || item.stockoutRiskLevel === 'ALTO')
    .map(item => ({
      id: `ml-${item.productId}`,
      priority: 'review' as const,
      title: `Reposición prioritaria: ${item.productName}`,
      message: `Stock: ${numberValue(item.stockActual).toLocaleString('es-PE')} · Reponer: ${Math.ceil(numberValue(item.recommendedReplenishment)).toLocaleString('es-PE')} unidades`,
      actionUrl: `/prediccion-demanda/producto?producto=${encodeURIComponent(item.productId)}`,
    }));
  return [...stock, ...expiry, ...ml].sort((left, right) =>
    Number(left.priority !== 'urgent') - Number(right.priority !== 'urgent') || left.title.localeCompare(right.title, 'es')
  );
}

export async function getOperationalAlerts(): Promise<AlertSnapshot> {
  const [stockAlerts, expiringLots, replenishments] = await Promise.all([
    getLowStockAlerts(),
    getExpiryAlerts(7),
    mlService.getLatestReplenishments().catch(() => []),
  ]);
  return { alerts: buildOperationalAlerts(stockAlerts, expiringLots, replenishments), stockAlerts, expiringLots, observedAt: new Date().toISOString() };
}
