import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

/**
 * Variable temporal para almacenar el JWT.
 * Actualmente se inicializa con un valor de ejemplo o null.
 * En la siguiente etapa se conectará y actualizará dinámicamente mediante React Context API.
 */
export let jwtToken: string | null = 'token_jwt_de_ejemplo_bodega_diza';

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
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
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

    // Si existe un JWT disponible, lo enviamos en los encabezados Bearer
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    // Registro informativo en consola para depuración
    console.debug(`[Axios Interceptor] Solicitud enviada a: ${config.url}`, {
      hasAuth: Boolean(token),
    });

    return config;
  },
  (error: AxiosError) => {
    console.error('[Axios Interceptor Request Error]', error);
    return Promise.reject(error);
  }
);

/**
 * MIDDLEWARE / INTERCEPTOR DE RESPUESTAS (RESPONSE)
 * Manejo centralizado de respuestas y errores comunes (p. ej. 401 Unauthorized o 403 Forbidden).
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      console.warn(
        '[Axios Interceptor] Sesión inválida o expirada (Error 401). Preparado para redirección / Context API.'
      );
    } else if (error.response?.status === 403) {
      console.warn('[Axios Interceptor] Acceso no autorizado a este recurso (Error 403).');
    }

    return Promise.reject(error);
  }
);

export default apiClient;
