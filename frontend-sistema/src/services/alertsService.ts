import { getExpiryAlerts, getLowStockAlerts, type ExpiringLot, type StockAlert } from './dashboardService';
import { mlService } from './mlService';
import type { ReplenishmentRecommendation } from '../types';

export type AlertPriority = 'critical' | 'warning' | 'preventive';
export type AlertKind = 'stock' | 'expiry' | 'pending' | 'prediction';
export type PredictionAvailability = 'available' | 'unavailable' | 'outdated';
export type OperationalAlert = {
  id: string; priority: AlertPriority; kind: AlertKind; sku: string;
  title: string; message: string; actionUrl: string; actionLabel: string;
};
export type AlertSnapshot = {
  alerts: OperationalAlert[]; stockAlerts: StockAlert[]; expiringLots: ExpiringLot[];
  observedAt: string; predictionAvailability: PredictionAvailability;
};
const rank: Record<AlertPriority, number> = { critical: 0, warning: 1, preventive: 2 };
const format = (value: number) => Number(value).toLocaleString('es-PE', { maximumFractionDigits: 3 });
const normalize = (sku: string) => sku.trim().toUpperCase();

export function buildOperationalAlerts(stockAlerts: StockAlert[], expiringLots: ExpiringLot[], replenishments: ReplenishmentRecommendation[]): OperationalAlert[] {
  const alerts = new Map<string, OperationalAlert>();
  const stockSkus = new Set<string>();
  for (const item of stockAlerts) {
    const sku = normalize(item.sku);
    stockSkus.add(sku);
    const empty = item.stockActual <= 0;
    const id = `stock-${sku}`;
    alerts.set(id, { id, sku, kind: 'stock', priority: empty ? 'critical' : 'warning',
      title: `${empty ? 'Agotado' : 'Stock bajo'}: ${item.nombre}`,
      message: `Vendible: ${format(item.stockActual)} · Mínimo: ${format(item.stockMinimo)} ${item.unidadMedida.toLowerCase()}`,
      actionLabel: 'Reponer', actionUrl: `/inventario/agregar?modo=restock&sku=${encodeURIComponent(item.sku)}${item.deficit > 0 ? `&cantidad=${encodeURIComponent(String(Math.ceil(item.deficit)))}` : ''}` });
  }
  for (const lot of expiringLots) {
    if (!(lot.cantidadDisponible > 0)) continue;
    let priority: AlertPriority;
    let label: string;
    switch (lot.estadoVencimiento) {
      case 'VENCIDO': priority = 'critical'; label = 'Lote vencido'; break;
      case 'HOY': priority = 'critical'; label = 'Vence hoy'; break;
      case 'CRITICO': priority = 'critical'; label = `Vence en ${lot.diasParaVencer} días`; break;
      case 'PROXIMO': priority = 'warning'; label = `Vence en ${lot.diasParaVencer} días`; break;
      case 'PREVENTIVO': priority = 'preventive'; label = `Vence en ${lot.diasParaVencer} días`; break;
      case 'PENDIENTE': priority = 'warning'; label = 'Vencimiento pendiente'; break;
      default: continue;
    }
    const pending = lot.estadoVencimiento === 'PENDIENTE';
    const id = `lot-${lot.id}`;
    alerts.set(id, { id, sku: lot.productoSku, priority, kind: pending ? 'pending' : 'expiry', title: `${label}: ${lot.productoNombre}`,
      message: `Lote ${lot.codigoLote} · Físico: ${format(lot.cantidadDisponible)} · Vendible: ${format(lot.vendible ? lot.cantidadDisponible : 0)}`,
      actionLabel: pending ? 'Regularizar lote' : 'Revisar lote',
      actionUrl: `/proximos-a-vencer?loteId=${lot.id}&lote=${encodeURIComponent(lot.codigoLote)}` });
  }
  for (const item of replenishments) {
    const sku = normalize(item.productId);
    if (stockSkus.has(sku) || !(item.recommendedReplenishment > 0)) continue;
    const high = item.stockoutRiskLevel === 'ALTO' || item.alertStatus === 'ROJO';
    if (!high && item.alertStatus !== 'AMARILLO') continue;
    const id = `ml-${sku}`;
    alerts.set(id, { id, sku, kind: 'prediction', priority: high ? 'warning' : 'preventive',
      title: `${high ? 'Riesgo estimado de agotamiento' : 'Reposición preventiva'}: ${item.productName}`,
      message: `Stock vendible: ${format(item.stockActual)} · Reposición sugerida: ${format(item.recommendedReplenishment)}`,
      actionLabel: 'Ver predicción', actionUrl: `/prediccion-demanda/producto?producto=${encodeURIComponent(item.productId)}` });
  }
  return [...alerts.values()].sort((a,b) => rank[a.priority] - rank[b.priority] || a.title.localeCompare(b.title, 'es') || a.id.localeCompare(b.id));
}

// El pronóstico puede comenzar mañana si el corte de ventas es hoy.
export function isForecastCurrent(from: string | null | undefined, to: string | null | undefined, today: string): boolean {
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to || today > to) return false;
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return from <= tomorrow.toISOString().slice(0,10);
}
const limaDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function getPredictionAlerts(): Promise<{ items: ReplenishmentRecommendation[]; availability: PredictionAvailability }> {
  try {
    const training = await mlService.getLatestTraining();
    if (!isForecastCurrent(training.forecastFromDate, training.forecastToDate, limaDate())) return { items: [], availability: 'outdated' };
    return { items: await mlService.getLatestReplenishments(), availability: 'available' };
  } catch {
    return { items: [], availability: 'unavailable' };
  }
}

export async function getOperationalAlerts(): Promise<AlertSnapshot> {
  const [stockAlerts, expiringLots, prediction] = await Promise.all([getLowStockAlerts(), getExpiryAlerts(30), getPredictionAlerts()]);
  return { alerts: buildOperationalAlerts(stockAlerts, expiringLots, prediction.items), stockAlerts, expiringLots,
    predictionAvailability: prediction.availability, observedAt: new Date().toISOString() };
}
