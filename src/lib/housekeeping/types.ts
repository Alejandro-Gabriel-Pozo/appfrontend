export type HousekeepingStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'INSPECTED' | 'OUT_OF_SERVICE'
export type Shift = 'MORNING' | 'AFTERNOON' | 'NIGHT'

export interface HousekeepingTask {
  id: string
  businessId: string
  resourceId: string
  assignedTo: string | null
  status: HousekeepingStatus
  notes: string | null
  shift: Shift
  scheduledFor: string
  startedAt: string | null
  completedAt: string | null
  inspectedAt: string | null
  inspectedBy: string | null
  createdAt: string
  updatedAt: string
  /** Transiciones válidas desde `status` — usar esto en vez de hardcodear la máquina de estados (A3). */
  allowedTransitions?: HousekeepingStatus[]
}

/**
 * Badge de solo lectura (18/08/2026, pendientes-2026-08-18.md punto N) —
 * reservas con late check-out APROBADO cuyo checkout cae en la fecha
 * consultada. No es una `HousekeepingTask` — se calcula al vuelo desde la
 * propia reserva, GET /api/housekeeping/late-checkouts.
 */
export interface LateCheckout {
  reservationId: string
  resourceId: string
  resourceName: string
  approvedCheckOutTime: string | null
}

export interface CreateHousekeepingTaskInput {
  resourceId: string
  shift: Shift
  scheduledFor: string
  notes?: string
}
