'use client'
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// ─── Token store en memoria (no localStorage) ────────────────────────────────
// Inicialización sincrónica al cargar el módulo: evita la ventana de tiempo
// entre el primer render y el useEffect de hidratación donde _memoryToken
// está vacío y los fetches del layout llegan sin token.
let _memoryToken = (() => {
  if (typeof window === 'undefined') return '' // SSR — no hay sessionStorage
  try {
    return sessionStorage.getItem('_rh_token') ?? ''
  } catch {
    return '' // iframe sandbox sin acceso a sessionStorage
  }
})()

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
      email:      payload.email ?? payload.sub ?? 'Usuario',
      role:       payload.role ?? '',
      businessId: payload.business_id,  // ✅ snake_case — así lo firma el backend
    }
  } catch {
    return null
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  // El estado inicial toma el token ya hidratado sincrónicamente
  const [token, setTokenState] = useState(_memoryToken)
  const [user, setUser] = useState<AuthUser | null>(() =>
    _memoryToken ? parseJwt(_memoryToken) : null,
  )
  // isLoading: false de entrada si ya teniamos token, true solo si no habia nada
  // (para evitar flash de redirect en usuarios ya autenticados)
  const [isLoading, setIsLoading] = useState(!_memoryToken)

  // Sincronización de seguridad: por si sessionStorage cambia en otra pestaña
  // (storage event) o si el IIFE de arriba falló silenciosamente
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('_rh_token') ?? ''
      if (stored && stored !== _memoryToken) {
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
