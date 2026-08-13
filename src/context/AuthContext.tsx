'use client'
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// ─── Token store en memoria, respaldado por localStorage ─────────────────────
// Hasta el 13/08/2026 esto usaba sessionStorage "por seguridad", pero
// sessionStorage no mitiga XSS mejor que localStorage (ambos son igual de
// legibles por JS malicioso si hay una vulnerabilidad de ese tipo — ver la
// nota en ARCHITECTURE.md, que ya señalaba httpOnly cookies como el fix real,
// pendiente). Lo único que cambiaba era la duración de la sesión — y
// sessionStorage es exclusivo de cada pestaña, nunca se comparte entre ellas,
// así que abrir una pestaña nueva (o duplicar la pestaña) perdía la sesión y
// disparaba 401 en el primer fetch. localStorage sí se comparte entre
// pestañas del mismo origen.
//
// Inicialización sincrónica al cargar el módulo: evita la ventana de tiempo
// entre el primer render y el useEffect de hidratación donde _memoryToken
// está vacío y los fetches del layout llegan sin token.
let _memoryToken = (() => {
  if (typeof window === 'undefined') return '' // SSR — no hay localStorage
  try {
    return localStorage.getItem('_rh_token') ?? ''
  } catch {
    return '' // iframe sandbox sin acceso a localStorage
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

  // Hidratación inicial (por si el IIFE de arriba falló silenciosamente) +
  // listener real de 'storage': con localStorage este evento sí se dispara
  // en las OTRAS pestañas cuando una pestaña hace login/logout — antes,
  // con sessionStorage, este mismo código nunca podía dispararse entre
  // pestañas (sessionStorage es exclusivo de cada una), así que login/logout
  // en una pestaña no se enteraba en las demás.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('_rh_token') ?? ''
      if (stored && stored !== _memoryToken) {
        _memoryToken = stored
        setTokenState(stored)
        setUser(parseJwt(stored))
      }
    } catch {
      // localStorage bloqueado (iframe sandbox) — solo memoria
    } finally {
      setIsLoading(false)
    }

    function onStorage(e: StorageEvent) {
      if (e.key !== '_rh_token') return
      const newToken = e.newValue ?? ''
      _memoryToken = newToken
      setTokenState(newToken)
      setUser(newToken ? parseJwt(newToken) : null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setToken = useCallback((t: string) => {
    _memoryToken = t
    setTokenState(t)
    setUser(parseJwt(t))
    try { localStorage.setItem('_rh_token', t) } catch { /* sandboxed */ }
  }, [])

  const clearToken = useCallback(() => {
    _memoryToken = ''
    setTokenState('')
    setUser(null)
    try { localStorage.removeItem('_rh_token') } catch { /* sandboxed */ }
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
