'use client'
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useParams } from 'next/navigation'

// ─── Sesión vía cookie httpOnly (19/08/2026, portal a httpOnly — mismo
// patrón que AuthContext.tsx aplicó al panel de staff, B2,
// docs/pendientes-2026-08-13.md en app-main) ────────────────────────────────
// Hasta el 19/08/2026 la sesión vivía en localStorage (`_rh_customer_session`),
// mismo hueco de XSS que motivó la migración original del staff. Ahora el
// backend setea una cookie httpOnly separada (`rh_customer_token` — nombre
// distinto al de staff a propósito, así un mismo navegador con las dos
// sesiones abiertas no se pisa una cookie con la otra) y el estado se
// resuelve preguntándole al backend con GET /api/customer/me.
//
// `businessSlug` ya no se guarda junto a la sesión: se pasa explícito en
// cada chequeo (`?businessSlug=`) y el backend rechaza con 401 si la cookie
// vigente es de OTRO negocio — antes esto se comparaba client-side
// (`session.businessSlug !== slug`), ahora lo valida el servidor (más
// confiable: la cookie viaja igual a cualquier /portal/* del mismo dominio,
// así que un cliente logueado en el negocio A que visita el portal del
// negocio B no debe verse como "logueado" ahí).

interface CustomerUser {
  id: string
  fullName: string
  email: string
}

interface CustomerAuthContextValue {
  customer: CustomerUser | null
  isLoading: boolean
  /** Vuelve a preguntarle al backend por la sesión para este negocio — se llama después de login/register. */
  refreshCustomer: (businessSlug: string) => Promise<CustomerUser | null>
  logout: () => Promise<void>
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null)

async function fetchMe(businessSlug: string): Promise<CustomerUser | null> {
  try {
    const res = await fetch(`/api/customer/me?businessSlug=${encodeURIComponent(businessSlug)}`, {
      credentials: 'include',
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Mismo criterio que AuthContext.tsx: refrescar en segundo plano bien por
// debajo del TTL del token (JWT_EXPIRES_IN default 24h) para que una sesión
// de compra larga no expire a mitad de camino. Silencioso a propósito — si
// falla, el próximo fetch real ya dispara el interceptor de 401/TOKEN_EXPIRED
// de customerApiFetch.
const SESSION_REFRESH_INTERVAL_MS = 20 * 60 * 1000

async function refreshSession(): Promise<void> {
  try {
    await fetch('/api/customer/refresh', { method: 'POST', credentials: 'include' })
  } catch {
    // Silencioso — ver comentario arriba.
  }
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const params = useParams()
  const slug = params?.businessSlug as string | undefined

  const [customer, setCustomer] = useState<CustomerUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshCustomer = useCallback(async (businessSlug: string) => {
    const c = await fetchMe(businessSlug)
    setCustomer(c)
    setIsLoading(false)
    return c
  }, [])

  // Al montar el provider (una vez por slug, ya que PortalLayout vive
  // dentro de /portal/[businessSlug]) pregunta si hay sesión activa para
  // ESTE negocio — mismo momento que AuthProvider pregunta /api/auth/me.
  useEffect(() => {
    if (!slug) return
    queueMicrotask(() => { void refreshCustomer(slug) })
  }, [slug, refreshCustomer])

  // Mientras haya sesión activa para este slug, extenderla en segundo plano.
  useEffect(() => {
    if (!slug || customer === null) return
    const id = setInterval(() => { void refreshSession() }, SESSION_REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [slug, customer])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/customer/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // Si el logout en el backend falla igual limpiamos el estado local —
      // peor caso, la cookie expira sola con el JWT.
    }
    setCustomer(null)
  }, [])

  return (
    <CustomerAuthContext.Provider value={{ customer, isLoading, refreshCustomer, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  )
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth debe usarse dentro de <CustomerAuthProvider>')
  return ctx
}
