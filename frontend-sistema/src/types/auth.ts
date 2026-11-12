import type { Id } from './common';

export type Rol = 'ADMIN';

export interface User {
  id: Id;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
