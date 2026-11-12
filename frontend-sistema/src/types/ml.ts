import type { IsoDateTime } from './common';

export interface PredictionMetrics {
  mae: number;
  rmse: number;
  mape: number | null;
  wape: number;
}

export interface TrainingResult {
  id: string;
  status: 'COMPLETED';
  modelName: string;
  trainedAt: IsoDateTime;
  metrics: PredictionMetrics;
  productsCount: number;
  observationsCount: number;
  validationRowsRejected: number;
}

export interface DemandPrediction {
  productId: string;
  productName: string;
  category: string;
  predictedDemand7Days: number;
  dailyPredictions: number[];
}

export type StockAlertStatus = 'VERDE' | 'AMARILLO' | 'ROJO';

export interface ReplenishmentRecommendation {
  productId: string;
  productName: string;
  category: string;
  stockActual: number;
  stockMinimoSeguridad: number;
  predictedDemand7Days: number;
  recommendedReplenishment: number;
  alertStatus: StockAlertStatus;
}
