import { useState, type ReactNode } from 'react';
import { setAuthToken } from '../api/axios';
import { AuthContext } from './authContextDef';
import type { User } from '../types';
import { authService, type LoginCredentials } from '../services/authService';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authService.login(credentials);
      if (!response.success || !response.data) {
        throw new Error(response.message || 'No fue posible iniciar sesión');
      }

      setTokenState(response.data.token);
      setUser(response.data.user);
      setAuthToken(response.data.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setTokenState(null);
    setUser(null);
    setAuthToken(null);
  };

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
