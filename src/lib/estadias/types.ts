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
  /**
   * MANAGEMENT fuerza el check-out pese a saldo pendiente (12/09/2026,
   * caso 3 de app-main/docs/investigacion-decisiones-bloqueado-2026-09-12.md).
   * El backend igual valida el rol — esto solo evita mostrar un botón
   * que el backend va a rechazar.
   */
  overridePendingBalance?: boolean
}

// ─── Folio de estadía (A1, paso 6) ─────────────────────────────────────────────

export interface StayFolio {
  stayId: string
  balance: number
  transactions: FinancialTransaction[]
}
