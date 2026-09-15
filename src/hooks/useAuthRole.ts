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

/**
 * `CANCEL-WITH-NC-UI-001` (15/09/2026) -- ¿este usuario puede ver la
 * acción "Cancelar con Nota de Crédito"? Espejo del grupo de permiso
 * `EMISOR_NOTA_CREDITO` (app-main/src/security/roles.ts), que hoy tienen
 * los presets OWNER, ADMIN y RECEPTIONIST (docs/rbac-matriz-endpoints.md)
 * -- por eso NO alcanza con `useIsManagement()` (excluye RECEPTIONIST a
 * propósito, la recepción SÍ puede emitir esta Nota de Crédito sin
 * escalar). El frontend solo conoce `user.role` (el preset), no los
 * grupos de permiso reales del tenant -- si un negocio reasigna sus
 * roles a mano (`platform.schema.sql`, custom), este chequeo puede
 * quedar desalineado; mismo límite ya aceptado por `useIsManagement()`/
 * `useIsOwner()`. El backend (`authorize(Roles.EMISOR_NOTA_CREDITO)`)
 * sigue siendo quien de verdad autoriza -- esto solo evita mostrar el
 * botón a quien el backend va a rechazar.
 */
export function useCanIssueCreditNote(): boolean {
  const { user } = useAuth()
  return user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST'
}
