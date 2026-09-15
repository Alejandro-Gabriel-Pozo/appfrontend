'use client'
import { apiFetch } from '../http'
import type { OffsetPaginatedResponse } from '../http'
import type { Reservation, CancelReservationWithCreditNoteResult } from './types'

/**
 * D-14 (15/09/2026, docs/decisiones-auditoria-fase2-2026-09-15.md #12,
 * backend app-main) — contrato canónico limit/offset (reemplaza page/limit).
 * El backend SIEMPRE devuelve el envelope `OffsetPaginatedResponse<Reservation>`
 * ahora (nunca un array plano), incluso sin `limit`/`offset` explícitos —
 * ver `respondWithReservationsList()` en `reservations.routes.ts`.
 */
export interface ReservationFilters {
  limit?:      number
  offset?:     number
  status?:     string
  from?:       string
  to?:         string
  /** K2 (23/08/2026) — separa Reservas (alojamiento) de Turnos server-side. */
  isLodging?:  boolean
  /** K2 (23/08/2026) — busca por customer_name/customer_email CONGELADOS en la reserva. */
  search?:     string
}

// ─── Reservations ─────────────────────────────────────────────────────────────
export const reservationsApi = {
  list: (filters: ReservationFilters = {}) => {
    // A7.2 (23/08/2026) — `search` es nombre/email tipeado por el usuario,
    // PII: nunca en query string. El resto de los filtros no lo es, viajan
    // igual en el body para no duplicar la llamada (mismo motivo que
    // customersApi.list — el request es uno solo, no dos).
    if (filters.search) {
      return apiFetch<OffsetPaginatedResponse<Reservation>>('/api/reservations/search', {
        method: 'POST',
        body: JSON.stringify({
          search: filters.search,
          ...(filters.status     !== undefined && { status: filters.status }),
          ...(filters.from       !== undefined && { from: filters.from }),
          ...(filters.to         !== undefined && { to: filters.to }),
          ...(filters.isLodging  !== undefined && { isLodging: filters.isLodging }),
          ...(filters.limit      !== undefined && { limit: filters.limit }),
          ...(filters.offset     !== undefined && { offset: filters.offset }),
        }),
      })
    }
    const params = new URLSearchParams()
    if (filters.limit !== undefined)  params.set('limit',  String(filters.limit))
    if (filters.offset !== undefined) params.set('offset', String(filters.offset))
    if (filters.status)             params.set('status',    filters.status)
    if (filters.from)               params.set('from',      filters.from)
    if (filters.to)                 params.set('to',        filters.to)
    if (filters.isLodging !== undefined) params.set('isLodging', String(filters.isLodging))
    const qs = params.toString()
    return apiFetch<OffsetPaginatedResponse<Reservation>>(
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
   * `CANCEL-WITH-NC-UI-001` (15/09/2026, F3-01/F3-02 de
   * app-main/docs/auditoria-integral-fase3-2026-09-15.md) -- escape
   * administrativo para cancelar una reserva que ya tiene una factura
   * ISSUED viva (el `cancel()` normal la rechaza con 409
   * RESERVATION_CHARGE_INVOICED). Requiere el rol EMISOR_NOTA_CREDITO
   * (ver `useCanIssueCreditNote()`, hooks/useAuthRole.ts) -- el backend
   * igual lo valida en serio.
   */
  cancelWithCreditNote: (id: string, reason: string) =>
    apiFetch<CancelReservationWithCreditNoteResult>(`/api/reservations/${id}/cancel-with-credit-note`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
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
