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

/**
 * Servicio de Autenticación de ejemplo.
 * Demuestra cómo los métodos utilizan el cliente axios configurado con interceptores.
 */
export const authService = {
  /**
   * Inicia sesión enviando credenciales a la API
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<LoginResult>> {
    const response = await apiClient.post<ApiResponse<LoginResult>>('/auth/login', credentials);
    return response.data;
  },

  /**
   * Obtiene el perfil del usuario autenticado (se enviará automáticamente el JWT gracias al interceptor)
   */
  async getProfile(): Promise<ApiResponse<User>> {
    const response = await apiClient.get<ApiResponse<User>>('/auth/profile');
    return response.data;
  },

  /**
   * Cierra sesión en el servidor
   */
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};

export default authService;
