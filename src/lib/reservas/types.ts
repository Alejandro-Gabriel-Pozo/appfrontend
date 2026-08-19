export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface Reservation {
  id: string
  resourceId: string
  customer: { id: string; fullName?: string; email?: string }
  startTime: string
  endTime: string
  status: ReservationStatus
  details?: Record<string, unknown>
  serviceId?: string | null
  partySize?: number
  notes?: string | null
  /** Desglose de huéspedes (hotelería, 18/08/2026) — null/undefined = no aplica a este tipo de reserva (ej. Turnos). */
  adultos?: number | null
  ninos?: number | null
  /** Tarifa elegida al reservar (spec de mejoras PMS, 18/08/2026) — trazabilidad, no la fuente del precio. */
  ratePlanId?: string | null
  totalPrice: number
  // El backend no trackea estas fechas a nivel de dominio para reservas
  // todavía (a diferencia de otras entidades) — quedan opcionales a
  // propósito, no asumir que siempre vienen.
  createdAt?: string
  updatedAt?: string
  /** Transiciones válidas desde `status` — usar esto en vez de hardcodear la máquina de estados (A3). */
  allowedTransitions?: ReservationStatus[]
  /**
   * Flujo de horario de check-in/check-out fuera del estándar (18/08/2026,
   * pendientes-2026-08-18.md punto N) — solo aplica a alojamiento.
   * `scheduleApprovalStatus`: null = sin pedido activo.
   */
  requestedCheckInTime?: string | null
  requestedCheckOutTime?: string | null
  scheduleApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  scheduleApprovedBy?: string | null
  scheduleChargeAmount?: number | null
}
