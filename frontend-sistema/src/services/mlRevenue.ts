import apiClient from '../api/axios';
import type { DemandPrediction } from '../types';

/** Solo precios operativos actuales; no modifica el modelo ni las predicciones. */
export type PriceMap = Record<string, number>;

type ProductRow = {
  sku?: string | null;
  precioVenta?: number | string | null;
};
type ProductListResponse = {
  success: boolean;
  data?: ProductRow[] | null;
  message?: string;
};

export const getCurrentSalePrices = async (): Promise<PriceMap> => {
  const response = await apiClient.get<ProductListResponse>('/productos');
  if (!response.data.success || !Array.isArray(response.data.data)) {
    throw new Error(response.data.message || 'No se pudieron consultar los precios de Inventario.');
  }
  const prices: PriceMap = {};
  for (const product of response.data.data) {
    if (!product.sku || product.precioVenta === null || product.precioVenta === undefined) continue;
    const price = Number(product.precioVenta);
    if (Number.isFinite(price) && price >= 0) {
      prices[product.sku.trim().toUpperCase()] = price;
    }
  }
  return prices;
};

export const formatSoles = (value: number): string =>
  `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const estimatedRevenue = (
  prediction: DemandPrediction,
  prices: PriceMap,
): number | null => {
  const price = prices[prediction.productId.trim().toUpperCase()];
  if (price === undefined) return null;
  const demand = Number(prediction.predictedDemand7Days);
  return Number.isFinite(demand) ? Math.max(0, demand) * price : null;
};

/** No incluye productos sin precio: evita presentar como cero una cifra desconocida. */
export const estimatedRevenueSummary = (
  predictions: DemandPrediction[], prices: PriceMap,
): { total: number; pricedProducts: number; products: number } => {
  let total = 0;
  let pricedProducts = 0;
  for (const prediction of predictions) {
    const amount = estimatedRevenue(prediction, prices);
    if (amount === null) continue;
    total += amount;
    pricedProducts += 1;
  }
  return { total, pricedProducts, products: predictions.length };
};
