export interface User {
  id: string | number;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'EMPLEADO' | 'SUPERVISOR';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}
