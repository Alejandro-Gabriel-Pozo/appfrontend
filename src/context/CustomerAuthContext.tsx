'use client'
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { CustomerSession } from '@/lib/types'

const STORAGE_KEY = '_rh_customer_session'

// ─── Sesión en memoria, respaldada por localStorage ───────────────────────
// Mismo patrón que AuthContext.tsx (incluido el mismo fix del 13/08/2026:
// sessionStorage no comparte sesión entre pestañas — abrir una pestaña
// nueva del portal perdía la sesión del cliente y disparaba 401 en el
// primer fetch — y no mitiga XSS mejor que localStorage, así que no había
// trade-off de seguridad real en el cambio). Hidratación sincrónica al
// cargar el módulo para evitar el flash de redirect entre el primer render
// y el useEffect. A diferencia del staff, acá no hace falta decodificar
// ningún JWT — register/login ya devuelven el objeto `customer` completo.
let _memorySession: CustomerSession | null = (() => {
  if (typeof window === 'undefined') return null // SSR
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CustomerSession) : null
  } catch {
    return null // JSON inválido o localStorage bloqueado (iframe sandbox)
  }
})()

export function getCustomerSessionImperative(): CustomerSession | null {
  return _memorySession
}

interface CustomerAuthContextValue {
  session: CustomerSession | null
  isLoading: boolean
  setSession: (session: CustomerSession) => void
  clearSession: () => void
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null)

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState(_memorySession)
  const [isLoading, setIsLoading] = useState(!_memorySession)

  useEffect(() => {
    // Diferido a un microtask -- el registro del listener de 'storage' de
    // abajo sí tiene que ser sincrónico (React necesita la función de
    // limpieza devuelta ya mismo), pero la hidratación inicial del estado
    // no.
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const stored = raw ? (JSON.parse(raw) as CustomerSession) : null
        if (stored && stored.token !== _memorySession?.token) {
          _memorySession = stored
          setSessionState(stored)
        }
      } catch {
        // localStorage bloqueado — solo memoria
      } finally {
        setIsLoading(false)
      }
    })

    // Con localStorage este evento sí se dispara en las OTRAS pestañas —
    // login/logout en una pestaña del portal ahora se refleja en las demás.
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return
      const stored = e.newValue ? (JSON.parse(e.newValue) as CustomerSession) : null
      _memorySession = stored
      setSessionState(stored)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setSession = useCallback((s: CustomerSession) => {
    _memorySession = s
    setSessionState(s)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* sandboxed */ }
  }, [])

  const clearSession = useCallback(() => {
    _memorySession = null
    setSessionState(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* sandboxed */ }
  }, [])

  return (
    <CustomerAuthContext.Provider value={{ session, isLoading, setSession, clearSession }}>
      {children}
    </CustomerAuthContext.Provider>
  )
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomerAuth debe usarse dentro de <CustomerAuthProvider>')
  return ctx
}
