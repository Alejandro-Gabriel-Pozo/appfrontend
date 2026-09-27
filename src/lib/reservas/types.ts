import type { Invoice } from '../facturacion/types'

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED'

/**
 * Asignación de recurso (v11/Fase 1, 25/09/2026, backend `app-main`
 * `src/reservas/Reservation.ts` — Wave 14 item 4.3, en producción desde el
 * deploy grande del 26/09/2026). Máquina de estados INDEPENDIENTE de `status`:
 * `PENDING_ASSIGNMENT` = el `resourceId` de la reserva es un candidato
 * provisorio (asignación diferida por categoría), todavía reoptimizable;
 * `ASSIGNED` = recurso confirmado. Solo el alta por `categoryId` de una
 * categoría de alojamiento puede nacer `PENDING_ASSIGNMENT` — cualquier otro
 * camino (resourceId explícito, o categoría que no es alojamiento, ej.
 * Turnos) nace `ASSIGNED` siempre. El staff DTO (`toReservationDto()`)
 * siempre incluye el campo; el DTO del portal de clientes lo omite
 * (`toCustomerReservationDto()`).
 */
export type AssignmentStatus = 'ASSIGNED' | 'PENDING_ASSIGNMENT'

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
  /**
   * v11/Fase 1 (25/09/2026) — ver el docblock de `AssignmentStatus` arriba.
   * Opcional a propósito, por dos motivos:
   * (a) el portal de clientes lo omite a propósito — `toCustomerReservationDto()`
   *     devuelve `Omit<ReservationDto, 'assignmentStatus'>` en los 4 endpoints
   *     de `customerReservationsApi` (`src/lib/customerApi.ts`), que tipan su
   *     respuesta como este mismo `Reservation`; el campo nunca llega ahí.
   * (b) puede faltar si el backend que sirve la request es ANTERIOR a Fase
   *     1 de 4.3 (`app-main` `src/reservas/Reservation.ts`, ej. un rollback
   *     a un deploy previo al 26/09/2026) — no un estado de deploy fijo,
   *     una condición a chequear en el momento (mismo criterio que el
   *     CLAUDE.md raíz sobre no registrar "¿está deployado?" como un hecho
   *     estable del texto).
   * Los lectores existentes (`=== 'PENDING_ASSIGNMENT'`) ya dan `false`
   * correctamente con `undefined` — no requieren cambios.
   */
  assignmentStatus?: AssignmentStatus
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
