import axios, {
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiResponse } from '../types';
import { ApiError } from '../types';

let jwtToken: string | null = null;
const defaultApiBaseUrl = 'http://localhost:8080';

const getApiBaseUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return configuredUrl || defaultApiBaseUrl;
};

/**
 * Permite actualizar la variable del JWT desde cualquier módulo (por ejemplo, desde el AuthContext).
 */
export const setAuthToken = (token: string | null): void => {
  jwtToken = token;
};

/**
 * Obtiene el valor actual del JWT.
 */
export const getAuthToken = (): string | null => {
  return jwtToken;
};

/**
 * Instancia central de Axios para la conexión a la API.
 */
export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/**
 * MIDDLEWARE / INTERCEPTOR DE PETICIONES (REQUEST)
 * Se ejecuta antes de que cada petición HTTP sea enviada.
 * Intercepta para inyectar automáticamente el header Authorization con el JWT.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = getAuthToken();

    if (config.data instanceof FormData) {
      config.headers.delete('Content-Type');
    }

    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    return config;
  },
  (error: unknown) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error))
);

const toApiError = (error: unknown): ApiError => {
  if (!axios.isAxiosError<ApiResponse>(error)) {
    return new ApiError('No fue posible conectar con la API.');
  }

  const status = error.response?.status;
  const message = error.response?.data?.message || getDefaultErrorMessage(status);
  return new ApiError(message, status);
};

const getDefaultErrorMessage = (status?: number): string => {
  if (status === 401) {
    return 'Credenciales inválidas o sesión expirada.';
  }
  if (status === 403) {
    return 'No tienes permisos para realizar esta acción.';
  }
  if (status && status >= 500) {
    return 'La API no está disponible en este momento.';
  }
  return 'No fue posible completar la solicitud.';
};

export default apiClient;
