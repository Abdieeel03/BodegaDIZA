import apiClient from '../api/axios';
import type { ApiResponse, User } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: User;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<ApiResponse<LoginResult>> {
    const response = await apiClient.post<ApiResponse<LoginResult>>('/auth/login', credentials);
    return response.data;
  },

  async getProfile(): Promise<ApiResponse<User>> {
    const response = await apiClient.get<ApiResponse<User>>('/auth/profile');
    return response.data;
  },

};

export default authService;
