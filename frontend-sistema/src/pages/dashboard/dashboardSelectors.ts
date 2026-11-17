import type { ProductoOperativo, VentaOperativa } from '../../services/testDataService';
import type { ExpiringLot, StockAlert } from '../../services/dashboardService';

export type MonthlyTotal = { key: string; label: string; amount: number };
export type ProductSales = { id: number; name: string; units: number; unitLabel: string };
export type DashboardAlert = {
  id: string;
  title: string;
  message: string;
  tone: 'danger' | 'warning';
  days?: number;
};

const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const datePart = (value: string) => value.slice(0, 10);
const finite = (value: number) => Number.isFinite(Number(value)) ? Number(value) : 0;

function unitLabel(unit?: string): string {
  const labels: Record<string, string> = {
    UNIDAD: 'und.', BOTELLA: 'bot.', CAJA: 'cajas', PACK: 'packs',
    LITRO: 'L', BOLSA: 'bolsas', LATA: 'latas', KILOGRAMO: 'kg',
  };
  return labels[unit ?? ''] ?? 'cant.';
}

function dateDaysAgo(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const calculated = new Date(Date.UTC(year, month - 1, day - days));
  return calculated.toISOString().slice(0, 10);
}

/** Todos los períodos se calculan respecto a la fecha local congelada al abrir Inicio. */
export function getDashboardSales(sales: VentaOperativa[], referenceDate: string) {
  const currentMonth = referenceDate.slice(0, 7);
  const today = sales.filter(sale => datePart(sale.fecha) === referenceDate);
  const month = sales.filter(sale => datePart(sale.fecha).slice(0, 7) === currentMonth);
  return {
    todayTotal: today.reduce((sum, sale) => sum + finite(sale.total), 0),
    monthTotal: month.reduce((sum, sale) => sum + finite(sale.total), 0),
    monthTickets: month.length,
  };
}

/** Seis meses calendario, incluido el mes actual. No se mezclan CSV históricos. */
export function getMonthlySales(sales: VentaOperativa[], referenceDate: string): MonthlyTotal[] {
  const year = Number(referenceDate.slice(0, 4));
  const month = Number(referenceDate.slice(5, 7)) - 1;
  return Array.from({ length: 6 }, (_, index) => {
    const position = year * 12 + month - 5 + index;
    const targetYear = Math.floor(position / 12);
    const targetMonth = ((position % 12) + 12) % 12;
    const key = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`;
    const amount = sales.filter(sale => datePart(sale.fecha).slice(0, 7) === key)
      .reduce((sum, sale) => sum + finite(sale.total), 0);
    return { key, label: `${months[targetMonth]} ${String(targetYear).slice(-2)}`, amount };
  });
}

/** Se cuentan productos únicos, aunque tengan varias alertas o lotes. */
export function countAlertedProducts(stock: StockAlert[], lots: ExpiringLot[]): number {
  return new Set([...stock.map(item => item.productoId), ...lots.map(item => item.productoId)]).size;
}

/** Los más/menos vendidos provienen de los detalles operativos de GET /ventas. */
export function getProductSalesRanking(
  sales: VentaOperativa[], products: ProductoOperativo[], referenceDate: string,
): { most: ProductSales[]; least: ProductSales[]; detailsAvailable: boolean } {
  const active = products.filter(product => product.activo);
  const map = new Map<number, ProductSales>(active.map(product => [product.id, {
    id: product.id, name: product.nombre, units: 0, unitLabel: unitLabel(product.unidadMedida),
  }]));
  const start = dateDaysAgo(referenceDate, 29);
  const recent = sales.filter(sale => {
    const day = datePart(sale.fecha);
    return day >= start && day <= referenceDate;
  });
  const detailsAvailable = recent.every(sale => Array.isArray(sale.detalles));
  if (!detailsAvailable) return { most: [], least: [], detailsAvailable: false };

  recent.forEach(sale => {
    (sale.detalles ?? []).forEach(detail => {
      const product = map.get(detail.productoId);
      if (product) product.units += finite(detail.cantidad);
    });
  });
  const ranked = [...map.values()];
  const byName = (a: ProductSales, b: ProductSales) => a.name.localeCompare(b.name, 'es');
  return {
    most: ranked.filter(product => product.units > 0).sort((a, b) => b.units - a.units || byName(a, b)).slice(0, 5),
    least: ranked.sort((a, b) => a.units - b.units || byName(a, b)).slice(0, 5),
    detailsAvailable: true,
  };
}

export function listDashboardAlerts(stock: StockAlert[], lots: ExpiringLot[]): DashboardAlert[] {
  const lowStock: DashboardAlert[] = stock.map(item => ({
    id: `stock-${item.productoId}`,
    title: item.stockActual <= 0 ? `Agotado: ${item.nombre}` : `Stock bajo: ${item.nombre}`,
    message: `Disponible: ${finite(item.stockActual).toLocaleString('es-PE')} · Mínimo: ${finite(item.stockMinimo).toLocaleString('es-PE')}`,
    tone: item.stockActual <= 0 ? 'danger' : 'warning',
  }));
  const expiry: DashboardAlert[] = lots
    .filter(lot => finite(lot.cantidadDisponible) > 0)
    .map(lot => ({
      id: `lot-${lot.id}`,
      title: lot.vencido ? `Lote vencido: ${lot.productoNombre}` : `Próximo a vencer: ${lot.productoNombre}`,
      message: `Lote ${lot.codigoLote} · ${lot.vencido ? 'Vencido' : `${lot.diasParaVencer} días restantes`}`,
      tone: lot.vencido || lot.diasParaVencer <= 7 ? 'danger' : 'warning',
      days: lot.diasParaVencer,
    }));
  return [...lowStock, ...expiry]
    .sort((a, b) => (a.tone === 'danger' ? 0 : 1) - (b.tone === 'danger' ? 0 : 1)
      || (a.days ?? 9999) - (b.days ?? 9999))
    .slice(0, 4);
}
