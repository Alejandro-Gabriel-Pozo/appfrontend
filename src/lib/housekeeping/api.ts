'use client'
import { apiFetch } from '../http'
import type { HousekeepingTask, CreateHousekeepingTaskInput, LateCheckout } from './types'

// ─── Housekeeping ───────────────────────────────────────────────────────────────
export const housekeepingApi = {
  listByDate: (date?: string) =>
    apiFetch<HousekeepingTask[]>(`/api/housekeeping${date ? `?date=${date}` : ''}`),
  create: (body: CreateHousekeepingTaskInput) =>
    apiFetch<HousekeepingTask>('/api/housekeeping', { method: 'POST', body: JSON.stringify(body) }),
  assign: (id: string, userId: string) =>
    apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/assign`, { method: 'POST', body: JSON.stringify({ userId }) }),
  start: (id: string) => apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/start`, { method: 'POST' }),
  complete: (id: string, notes?: string) =>
    apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/complete`, { method: 'POST', body: JSON.stringify({ notes }) }),
  inspect: (id: string) => apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/inspect`, { method: 'POST' }),
  outOfService: (id: string, reason?: string) =>
    apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/out-of-service`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reset: (id: string) => apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/reset`, { method: 'POST' }),
  /**
   * Badge de solo lectura (18/08/2026, pendientes-2026-08-18.md punto N):
   * reservas con late check-out APROBADO cuyo checkout cae en `date`.
   */
  lateCheckouts: (date?: string) =>
    apiFetch<LateCheckout[]>(`/api/housekeeping/late-checkouts${date ? `?date=${date}` : ''}`),
}
