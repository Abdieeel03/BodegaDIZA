import type { IsoDateTime } from './common';

export interface PredictionMetrics {
  mae: number;
  rmse: number;
  mape: number | null;
  wape: number;
}

export interface HillClimbingSummary {
  algorithm: string;
  modelName: string;
  iterations: number;
  evaluatedNeighbors: number;
  improved: boolean;
  initialMae: number;
  bestMae: number;
  bestParams: Record<string, number>;
}

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
}

export interface ClassificationSummary {
  modelName: string;
  metrics: ClassificationMetrics;
  observationsCount: number;
  positiveRate: number;
  horizonEvents: number;
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
  hillClimbing?: HillClimbingSummary | null;
  classification?: ClassificationSummary | null;
}

export interface DemandPrediction {
  productId: string;
  productName: string;
  category: string;
  predictedDemand7Days: number;
  dailyPredictions: number[];
}

export type StockAlertStatus = 'VERDE' | 'AMARILLO' | 'ROJO';
export type StockoutRiskLevel = 'ALTO' | 'MEDIO' | 'BAJO';

export interface ReplenishmentRecommendation {
  productId: string;
  productName: string;
  category: string;
  stockActual: number;
  stockMinimoSeguridad: number;
  predictedDemand7Days: number;
  recommendedReplenishment: number;
  alertStatus: StockAlertStatus;
  stockoutProbability?: number | null;
  stockoutRiskLevel?: StockoutRiskLevel | null;
  daysOfStockRemaining?: number | null;
}

export interface ReplenishmentOptimizationItem {
  productId: string;
  productName: string;
  category: string;
  alertStatus: StockAlertStatus;
  recommendedReplenishment: number;
  allocatedUnits: number;
  unmetUnits: number;
  unitCost: number;
  totalCost: number;
}

export interface ReplenishmentOptimizationResult {
  algorithm: string;
  budget: number;
  budgetUsed: number;
  budgetRemaining: number;
  iterations: number;
  coverageScore: number;
  items: ReplenishmentOptimizationItem[];
}
