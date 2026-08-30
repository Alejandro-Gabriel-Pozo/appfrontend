'use client'
import { apiFetch } from '../http'
import type { OperatingWindow, BusinessProfile } from './types'

export const businessProfileApi = {
  get: () => apiFetch<BusinessProfile>('/api/business-profile'),
  update: (body: {
    displayName?: string | null
    contactEmail?: string | null
    defaultCheckInTime?: string
    defaultCheckOutTime?: string
    legalName?: string | null
    taxId?: string | null
    taxIdType?: string | null
    taxCondition?: string | null
    fiscalAddressLine1?: string | null
    fiscalAddressCity?: string | null
    fiscalAddressState?: string | null
    fiscalAddressPostalCode?: string | null
    fiscalAddressCountry?: string | null
    afipSalesPoint?: number | null
    afipCuit?: string | null
    defaultIvaRate?: number
    pricesIncludeIva?: boolean
  }) => apiFetch<BusinessProfile>('/api/business-profile', { method: 'PUT', body: JSON.stringify(body) }),
}

// ─── Horario de atención (default del negocio) ───────────────────────────────
export const businessHoursApi = {
  list: () => apiFetch<OperatingWindow[]>('/api/business-hours'),
  create: (body: { dayOfWeek: number; startTime: string; endTime: string }) =>
    apiFetch<OperatingWindow>('/api/business-hours', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/api/business-hours/${id}`, { method: 'DELETE' }),
}

// ─── Límites de plan del negocio (L, 23/08/2026) ─────────────────────────────
// `null` en los numéricos = sin límite, 'ALL' en las listas = sin
// restricción — mismo contrato que PlanLimits (app-main/src/config/plan-limits.ts).
// Lo necesita dashboard/roles/page.tsx para el gating visual del CRUD de
// roles propios (maxCustomRoles/allowedPermissionGroups).
export interface BusinessPlanLimits {
  maxCategories: number
  maxResources: number
  maxActiveMemberships: number
  maxCustomRoles: number
  allowedRoleNames: string[] | 'ALL'
  allowedPermissionGroups: string[] | 'ALL'
}

export const businessPlanLimitsApi = {
  get: () => apiFetch<{ plan: string; limits: BusinessPlanLimits }>('/api/business/plan-limits'),
}
