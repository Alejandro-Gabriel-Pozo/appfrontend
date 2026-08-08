'use client'
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// ─── Token store en memoria (no localStorage) ────────────────────────────────
// Usamos una variable de módulo como singleton para que getTokenImperative()
// funcione fuera del árbol de React (ej: api.ts)
let _memoryToken = ''

export function getTokenImperative(): string {
  return _memoryToken
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface AuthUser {
  email: string
  role: string
  businessId?: string
}

interface AuthContextValue {
  token: string
  user: AuthUser | null
  isLoading: boolean
  setToken: (token: string) => void
  clearToken: () => void
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null)

function parseJwt(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      email: payload.email ?? payload.sub ?? 'Usuario',
      role: payload.role ?? '',
      businessId: payload.businessId,
    }
  } catch {
    return null
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState('')
  const [user, setUser] = useState<AuthUser | null>(null)
  // isLoading evita el flash de redirect mientras hidratamos desde sessionStorage
  const [isLoading, setIsLoading] = useState(true)

  // Hidratación inicial: sessionStorage es más seguro que localStorage
  // (no persiste entre pestañas y tiene scope de sesión)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('_rh_token') ?? ''
      if (stored) {
        _memoryToken = stored
        setTokenState(stored)
        setUser(parseJwt(stored))
      }
    } catch {
      // sessionStorage bloqueado (iframe sandbox) — solo memoria
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setToken = useCallback((t: string) => {
    _memoryToken = t
    setTokenState(t)
    setUser(parseJwt(t))
    try { sessionStorage.setItem('_rh_token', t) } catch { /* sandboxed */ }
  }, [])

  const clearToken = useCallback(() => {
    _memoryToken = ''
    setTokenState('')
    setUser(null)
    try { sessionStorage.removeItem('_rh_token') } catch { /* sandboxed */ }
    // Compatibilidad: limpia localStorage viejo si existe
    try { localStorage.removeItem('token') } catch { /* sandboxed */ }
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, isLoading, setToken, clearToken }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
