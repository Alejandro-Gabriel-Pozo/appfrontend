import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { api, setSession, clearSession, getStoredUser, type AuthUser, type LoginResponse } from './api';

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResponse>('/api/login', { email, password });
    setSession(result.token, result.user);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
