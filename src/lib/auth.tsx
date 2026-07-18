import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
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

  useEffect(() => {
    // Si cualquier request recibe 401 (token vencido, revocado, etc.), api.ts
    // limpia localStorage y dispara este evento — acá sincronizamos el estado
    // de React para que <Layout> redirija a /login en el acto, en vez de dejar
    // la pantalla actual haciendo requests sin Authorization.
    function handleUnauthorized() {
      setUser(null);
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
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
