import type { Invoice } from '../facturacion/types'

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED'

export interface Reservation {
  id: string
  /**
   * Identidad operativa (D6, 01/09/2026): entero secuencial, obligatorio,
   * emitido por `app-main/src/api/mappers/reservation.mapper.ts` en TODAS
   * las rutas (incluido el portal de clientes) — nunca `undefined`. Se
   * presenta con prefijo vía `useNumeroOperativo()` en
   * `@/lib/business-context/numero-operativo`; ninguna pantalla debe
   * concatenar `RES-` a mano.
   */
  reservationNumber: number
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

/**
 * `CANCEL-WITH-NC-UI-001` (15/09/2026) -- respuesta de
 * `POST /api/reservations/:id/cancel-with-credit-note`
 * (app-main/src/reservas/reservations.routes.ts). Distinto del `Reservation`
 * plano que devuelve `cancel()` normal: además de la reserva ya cancelada,
 * trae la Nota de Crédito emitida y, si la estadía tenía algún traspaso a
 * cuentas corrientes activo (City Ledger), una advertencia por cada uno --
 * `accountsReceivableWarning` viene `undefined` (nunca `[]`) cuando no
 * aplica, así el consumidor puede chequear `'accountsReceivableWarning' in
 * result` sin ambigüedad.
 */
export interface AccountsReceivableWarningEntry {
  accountsReceivableId: string
  companyCustomerId: string
  status: string
  amount: number
}

export interface CancelReservationWithCreditNoteResult {
  reservation: Reservation
  creditNote: Invoice
  adjustmentId: string
  originalInvoiceId: string
  /** true si esta llamada emitió la Nota de Crédito ahora; false si un reintento la resolvió por un fast-path idempotente. */
  emitted: boolean
  accountsReceivableWarning?: AccountsReceivableWarningEntry[]
}
