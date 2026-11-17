import apiClient from '../api/axios';
import type {
  ApiResponse,
  DemandPrediction,
  ReplenishmentOptimizationResult,
  ReplenishmentRecommendation,
  TrainingResult,
} from '../types';

const unwrap = <T>(response: ApiResponse<T>): T => {
  if (!response.success || !response.data) {
    throw new Error(response.message || 'La API no devolvió datos de predicción.');
  }
  return response.data;
};

export const mlService = {
  async getLatestTraining(): Promise<TrainingResult> {
    const response = await apiClient.get<ApiResponse<TrainingResult>>('/ml/trainings/latest');
    return unwrap(response.data);
  },

  async train(salesFile?: File | null, productsFile?: File | null): Promise<TrainingResult> {
    if (salesFile && productsFile) {
      const formData = new FormData();
      formData.append('salesFile', salesFile);
      formData.append('productsFile', productsFile);
      const response = await apiClient.post<ApiResponse<TrainingResult>>('/ml/trainings', formData, { timeout: 120000 });
      return unwrap(response.data);
    }
    const response = await apiClient.post<ApiResponse<TrainingResult>>('/ml/trainings', undefined, { timeout: 120000 });
    return unwrap(response.data);
  },

  async getLatestPredictions(): Promise<DemandPrediction[]> {
    const response = await apiClient.get<ApiResponse<DemandPrediction[]>>('/ml/predictions/latest');
    return unwrap(response.data);
  },

  async getLatestReplenishments(): Promise<ReplenishmentRecommendation[]> {
    const response = await apiClient.get<ApiResponse<ReplenishmentRecommendation[]>>(
      '/ml/replenishments/latest'
    );
    return unwrap(response.data);
  },

  async optimizeReplenishments(budget: number): Promise<ReplenishmentOptimizationResult> {
    const response = await apiClient.get<ApiResponse<ReplenishmentOptimizationResult>>(
      '/ml/replenishments/optimize',
      { params: { budget } }
    );
    return unwrap(response.data);
  },
};

export default mlService;
