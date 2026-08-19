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

// ─── Módulos habilitados (entitlements) ──────────────────────────────────────
// Record dinámico a propósito, en vez de un enum duplicado del backend:
// la fuente de verdad de qué module_key existen es la tabla `modules` en
// app-main — acá solo se consume lo que venga.
export const businessModulesApi = {
  get: () => apiFetch<{ modules: Record<string, boolean> }>('/api/business/modules'),
}
