import apiClient from '../api/axios';
import type {
  ApiResponse,
  DemandPrediction,
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
  async train(salesFile: File, productsFile: File): Promise<TrainingResult> {
    const formData = new FormData();
    formData.append('salesFile', salesFile);
    formData.append('productsFile', productsFile);
    const response = await apiClient.post<ApiResponse<TrainingResult>>('/ml/trainings', formData);
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
};

export default mlService;
