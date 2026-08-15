'use client'
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// ─── Sesión vía cookie httpOnly (B2, paso 3 — docs/pendientes-2026-08-13.md
// en app-main) ──────────────────────────────────────────────────────────────
// Hasta el 13/08/2026 el token vivía en localStorage y se decodificaba
// client-side con parseJwt() para saber quién era el usuario. Ahora el
// backend setea una cookie httpOnly en el login (auth.middleware.ts /
// auth.routes.ts en app-main) que JS no puede leer — ese es el punto:
// un XSS ya no puede robar la sesión. El estado se resuelve preguntándole
// al backend con GET /api/auth/me, que decodifica el JWT server-side y
// además resuelve el email real (el JWT nunca lo llevó en el payload —
// antes esto terminaba mostrando el UUID de la identity como "email" en
// el sidebar, sin que nadie lo hubiera notado).
//
// Efecto colateral bueno: las pestañas nuevas ya no necesitan un listener
// de 'storage' para enterarse de la sesión — la cookie viaja sola en cada
// fetch del browser, así que cada pestaña simplemente pregunta
// /api/auth/me al montar. Esto resuelve de raíz el mismo bug de "401 en
// pestaña nueva" que motivó el fix de emergencia a localStorage, pero sin
// depender de que las pestañas se sincronicen entre sí.

interface AuthUser {
  id: string
  email: string
  role: string
  businessId?: string
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  /** Vuelve a preguntarle al backend por la sesión — se llama después del login. */
  refreshUser: () => Promise<AuthUser | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    return {
      id: data.id,
      email: data.email ?? data.id,
      role: data.role ?? '',
      businessId: data.businessId,
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const u = await fetchMe()
    setUser(u)
    setIsLoading(false)
    return u
  }, [])

  // Al montar cada pestaña/carga de página, preguntar si hay sesión activa.
  useEffect(() => {
    queueMicrotask(refreshUser)
  }, [refreshUser])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // Si el logout en el backend falla igual limpiamos el estado local —
      // peor caso, la cookie expira sola con el JWT.
    }
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: user !== null, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
