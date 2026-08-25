'use client'
import { apiFetch } from '../http'
import type { HousekeepingTask, CreateHousekeepingTaskInput, LateCheckout, HousekeepingStatus } from './types'

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
  // outOfService/reset se sacaron (25/08/2026) -- las rutas del backend que
  // llamaban se borraron por huérfanas (maintenance_window las reemplazó
  // el 24/08/2026); acá ya no las llamaba nadie tampoco.
  /**
   * Badge de solo lectura (18/08/2026, pendientes-2026-08-18.md punto N):
   * reservas con late check-out APROBADO cuyo checkout cae en `date`.
   */
  lateCheckouts: (date?: string) =>
    apiFetch<LateCheckout[]>(`/api/housekeeping/late-checkouts${date ? `?date=${date}` : ''}`),
  /** Mis tareas — el housekeeper logueado, sin filtro de fecha (19/08/2026, E7a). */
  me: () => apiFetch<HousekeepingTask[]>('/api/housekeeping/me'),
  /** Tablero filtrado por estado, todas las fechas/asignados (19/08/2026, E7a). */
  byStatus: (status: HousekeepingStatus) =>
    apiFetch<HousekeepingTask[]>(`/api/housekeeping/status/${status}`),
}
