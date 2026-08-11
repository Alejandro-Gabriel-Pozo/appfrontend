'use client'
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { CustomerSession } from '@/lib/types'

const STORAGE_KEY = '_rh_customer_session'

// ─── Sesión en memoria (no localStorage) ──────────────────────────────────
// Mismo patrón que AuthContext.tsx: hidratación sincrónica al cargar el
// módulo para evitar el flash de redirect entre el primer render y el
// useEffect. A diferencia del staff, acá no hace falta decodificar ningún
// JWT — register/login ya devuelven el objeto `customer` completo.
let _memorySession: CustomerSession | null = (() => {
  if (typeof window === 'undefined') return null // SSR
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CustomerSession) : null
  } catch {
    return null // JSON inválido o sessionStorage bloqueado (iframe sandbox)
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
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      const stored = raw ? (JSON.parse(raw) as CustomerSession) : null
      if (stored && stored.token !== _memorySession?.token) {
        _memorySession = stored
        setSessionState(stored)
      }
    } catch {
      // sessionStorage bloqueado — solo memoria
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setSession = useCallback((s: CustomerSession) => {
    _memorySession = s
    setSessionState(s)
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* sandboxed */ }
  }, [])

  const clearSession = useCallback(() => {
    _memorySession = null
    setSessionState(null)
    try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* sandboxed */ }
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
