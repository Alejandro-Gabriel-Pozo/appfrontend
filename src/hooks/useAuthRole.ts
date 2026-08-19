'use client'
import { useAuth } from '@/context/AuthContext'

/**
 * Chequeos de rol de staff (Fase 3, docs/auditoria-modularidad.md,
 * hallazgo F7) — antes cada pantalla escribía `role === 'OWNER' || role
 * === 'ADMIN'` (o su variante `role === 'OWNER'` a secas) a mano, sin
 * ninguna fuente compartida. El backend ya tiene el equivalente
 * centralizado en `security/roles.ts` (`Roles.MANAGEMENT`); esto es su
 * espejo del lado del frontend — no gatea nada por sí solo (el backend
 * sigue siendo quien de verdad autoriza cada endpoint), solo evita mostrar
 * en la UI una acción que el backend va a rechazar.
 */
export function useIsManagement(): boolean {
  const { user } = useAuth()
  return user?.role === 'OWNER' || user?.role === 'ADMIN'
}

/** Acciones reservadas solo al dueño del negocio (ej. eliminar usuarios). */
export function useIsOwner(): boolean {
  const { user } = useAuth()
  return user?.role === 'OWNER'
}
