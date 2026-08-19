'use client'
import { apiFetch } from '../http'
import type { OperatingWindow } from '../negocio/types'
import type { Resource, CreateResourceInput, UpdateResourceInput } from './types'

// ─── Resources ────────────────────────────────────────────────────────────────
export const resourcesApi = {
  list:   ()                              => apiFetch<Resource[]>('/api/resources'),
  create: (body: CreateResourceInput)     => apiFetch<Resource>('/api/resources', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateResourceInput) =>
    apiFetch<Resource>(`/api/resources/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string)                   => apiFetch<void>(`/api/resources/${id}`, { method: 'DELETE' }),
}

/** Horario propio de un recurso puntual — reemplaza (no combina) el horario por defecto del negocio para ese recurso. */
export const resourceHoursApi = {
  list: (resourceId: string) => apiFetch<OperatingWindow[]>(`/api/resources/${resourceId}/hours`),
  create: (resourceId: string, body: { dayOfWeek: number; startTime: string; endTime: string }) =>
    apiFetch<OperatingWindow>(`/api/resources/${resourceId}/hours`, { method: 'POST', body: JSON.stringify(body) }),
  remove: (resourceId: string, hourId: string) =>
    apiFetch<void>(`/api/resources/${resourceId}/hours/${hourId}`, { method: 'DELETE' }),
}
