'use client'
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

const STORAGE_KEY = '_rh_platform_session'

// ─── Sesión de SUPERADMIN (panel /superadmin) ─────────────────────────────
// Deliberadamente distinto de AuthContext.tsx (cookie httpOnly): POST
// /platform/login devuelve el JWT en el body, nunca setea cookie (no hay
// ningún res.cookie en platform.auth.service.ts) -- no hay nada que una
// cookie pudiera transportar acá. Más cerca de CustomerAuthContext.tsx
// (localStorage), pero con sessionStorage en vez de localStorage: alcance
// de pestaña a propósito, dado que es la sesión más sensible de las tres
// (ve todos los negocios) y su TTL ya es corto (8h, la mitad que el de
// empleados). Sin listener de 'storage': sessionStorage no se comparte
// entre pestañas por diseño, así que no hace falta sincronizar nada.
export interface PlatformSession {
  token: string
  tokenType: 'Bearer'
  email: string
  expiresAt: number // epoch ms -- calculado una vez al loguearse
}

function readSession(): PlatformSession | null {
  if (typeof window === 'undefined') return null // SSR
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PlatformSession
    if (parsed.expiresAt <= Date.now()) return null // token vencido, no confiar en él
    return parsed
  } catch {
    return null // JSON inválido o sessionStorage bloqueado
  }
}

interface PlatformAuthContextValue {
  session: PlatformSession | null
  isLoading: boolean
  isAuthenticated: boolean
  setSession: (input: { token: string; tokenType: 'Bearer'; expiresIn: number; email: string }) => void
  clearSession: () => void
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null)

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  // Lazy init (no useEffect): sessionStorage es sincrónico y por-pestaña,
  // no hace falta el truco de hidratación de CustomerAuthContext (ese
  // existe para evitar un flash antes de que corra el primer efecto en un
  // valor que puede llegar por otra pestaña -- acá no aplica).
  const [session, setSessionState] = useState<PlatformSession | null>(() => readSession())
  const [isLoading] = useState(false)

  const setSession = useCallback((input: { token: string; tokenType: 'Bearer'; expiresIn: number; email: string }) => {
    const next: PlatformSession = {
      token: input.token,
      tokenType: input.tokenType,
      email: input.email,
      expiresAt: Date.now() + input.expiresIn * 1000,
    }
    setSessionState(next)
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* sandboxed */ }
  }, [])

  const clearSession = useCallback(() => {
    setSessionState(null)
    try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* sandboxed */ }
  }, [])

  return (
    <PlatformAuthContext.Provider value={{ session, isLoading, isAuthenticated: session !== null, setSession, clearSession }}>
      {children}
    </PlatformAuthContext.Provider>
  )
}

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext)
  if (!ctx) throw new Error('usePlatformAuth debe usarse dentro de <PlatformAuthProvider>')
  return ctx
}

/** Lectura imperativa para platformApi.ts (fuera de React) -- mismo patrón que getCustomerSessionImperative(). */
export function getPlatformSessionImperative(): PlatformSession | null {
  return readSession()
}
