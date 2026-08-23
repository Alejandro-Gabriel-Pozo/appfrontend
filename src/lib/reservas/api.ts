'use client'
import { apiFetch } from '../http'
import type { PaginatedResponse } from '../http'
import type { Reservation } from './types'

export interface ReservationFilters {
  page?:   number
  limit?:  number
  status?: string
  from?:   string
  to?:     string
}

// ─── Reservations ─────────────────────────────────────────────────────────────
export const reservationsApi = {
  list: (filters: ReservationFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page)   params.set('page',   String(filters.page))
    if (filters.limit)  params.set('limit',  String(filters.limit))
    if (filters.status) params.set('status', filters.status)
    if (filters.from)   params.set('from',   filters.from)
    if (filters.to)     params.set('to',     filters.to)
    const qs = params.toString()
    return apiFetch<PaginatedResponse<Reservation> | Reservation[]>(
      `/api/reservations${qs ? `?${qs}` : ''}`,
    )
  },
  get:      (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}`),
  // K4 (23/08/2026, pendientes-2026-08-23.md) — resourceId (recurso puntual)
  // O categoryId (asignación automática, primer recurso libre de la
  // categoría) -- mutuamente excluyentes, mismo contrato que
  // CreateReservationSchema del backend.
  create: (body: { resourceId: string; customer: { id: string }; startTime: string; endTime: string; serviceId?: string; details?: Record<string, unknown>; adultos?: number; ninos?: number; ratePlanId?: string }
    | { categoryId: string; customer: { id: string }; startTime: string; endTime: string; serviceId?: string; details?: Record<string, unknown>; adultos?: number; ninos?: number; ratePlanId?: string }) =>
    apiFetch<Reservation>('/api/reservations', { method: 'POST', body: JSON.stringify(body) }),
  // El backend registra PUT /api/reservations/:id (no PATCH) — antes esto
  // mandaba PATCH y el backend nunca tuvo ese handler, así que editar una
  // reserva desde el dashboard devolvía 404 en silencio.
  update: (id: string, body: { startTime?: string; endTime?: string; details?: Record<string, unknown>; resourceId?: string; adultos?: number | null; ninos?: number | null; ratePlanId?: string | null }) =>
    apiFetch<Reservation>(`/api/reservations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  confirm:  (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}/confirm`,  { method: 'POST' }),
  cancel:   (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}/cancel`,   { method: 'POST' }),
  complete: (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}/complete`, { method: 'POST' }),
  /**
   * Flujo de horario de check-in/check-out fuera del estándar (18/08/2026,
   * pendientes-2026-08-18.md punto N). `scheduleRequest` lo puede iniciar
   * el propio huésped o el staff; approve/reject son solo staff
   * (FRONT_DESK) -- el backend igual lo valida, esto solo evita mostrar el
   * botón a quien no puede usarlo.
   */
  requestScheduleChange: (id: string, body: { requestedCheckInTime?: string; requestedCheckOutTime?: string }) =>
    apiFetch<Reservation>(`/api/reservations/${id}/schedule-request`, { method: 'POST', body: JSON.stringify(body) }),
  approveScheduleChange: (id: string, body: { chargeAmount?: number } = {}) =>
    apiFetch<Reservation>(`/api/reservations/${id}/schedule-request/approve`, { method: 'POST', body: JSON.stringify(body) }),
  rejectScheduleChange: (id: string) =>
    apiFetch<Reservation>(`/api/reservations/${id}/schedule-request/reject`, { method: 'POST' }),
  /**
   * Ajuste de precio de una reserva CONFIRMED (19/08/2026, pendientes-
   * 2026-08-18.md punto I). `previewPriceAdjustment` es de solo lectura —
   * compara el totalPrice congelado contra lo que costaría hoy con las
   * fechas/recurso actuales de la reserva; `null` si no aplica o no hay
   * diferencia. `confirmPriceAdjustment` recién ahí aplica el cambio y
   * genera el cargo/nota de crédito correspondiente — nunca automático.
   */
  previewPriceAdjustment: (id: string) =>
    apiFetch<{ currentTotalPrice: number; recalculatedTotalPrice: number; difference: number } | null>(
      `/api/reservations/${id}/price-preview`,
    ),
  confirmPriceAdjustment: (id: string) =>
    apiFetch<Reservation>(`/api/reservations/${id}/confirm-price-adjustment`, { method: 'POST' }),
}
