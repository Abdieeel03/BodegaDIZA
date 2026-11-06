import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

let jwtToken: string | null = null;

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
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
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

    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(error)
);

export default apiClient;
