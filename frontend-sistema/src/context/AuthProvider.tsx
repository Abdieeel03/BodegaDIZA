import { useState, useEffect, type ReactNode } from 'react';
import { setAuthToken, getAuthToken } from '../api/axios';
import { AuthContext } from './authContextDef';
import type { User } from '../types';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [token, setTokenState] = useState<string | null>(() => getAuthToken());
  const [user, setUser] = useState<User | null>(() => {
    return token
      ? { id: 1, nombre: 'Usuario Demostración', email: 'admin@bodegadiza.com', rol: 'ADMIN' }
      : null;
  });

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setTokenState(newToken);
    setUser(newUser);
    setAuthToken(newToken);
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
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
