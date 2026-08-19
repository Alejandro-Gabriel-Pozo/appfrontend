import type { Shift } from '../housekeeping/types'
import type { FinancialTransaction } from '../finanzas/types'

// ─── Stays (check-in / check-out) ──────────────────────────────────────────────
export type StayStatus = 'CHECKED_IN' | 'CHECKED_OUT' | 'NO_SHOW'

export interface Stay {
  id: string
  businessId: string
  reservationId: string
  resourceId: string
  customerId: string
  assignedBy: string
  status: StayStatus
  checkedInAt: string
  checkedOutAt: string | null
  noShowAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CheckInInput {
  reservationId: string
  resourceId: string
  notes?: string
}

export interface CheckOutInput {
  notes?: string
  nextCleaningShift?: Shift
}

// ─── Folio de estadía (A1, paso 6) ─────────────────────────────────────────────

export interface StayFolio {
  stayId: string
  balance: number
  transactions: FinancialTransaction[]
}
