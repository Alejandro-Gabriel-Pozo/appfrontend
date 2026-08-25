'use client'
import { apiFetch } from '../http'
import type { MaintenanceWindow, CreateMaintenanceWindowInput } from './types'

export const maintenanceWindowsApi = {
  /** Ventanas todavía relevantes del negocio (abiertas o con fin futuro). */
  listActive: () => apiFetch<MaintenanceWindow[]>('/api/maintenance-windows'),
  /** Histórico completo de un recurso, incluidas ventanas ya cerradas/vencidas. */
  listByResource: (resourceId: string) =>
    apiFetch<MaintenanceWindow[]>(`/api/maintenance-windows/resource/${resourceId}`),
  create: (body: CreateMaintenanceWindowInput) =>
    apiFetch<MaintenanceWindow>('/api/maintenance-windows', { method: 'POST', body: JSON.stringify(body) }),
  /** `closeDate` opcional -- default: hoy (fecha de negocio). */
  close: (id: string, closeDate?: string) =>
    apiFetch<MaintenanceWindow>(`/api/maintenance-windows/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(closeDate ? { closeDate } : {}),
    }),
}
