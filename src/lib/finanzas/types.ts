// ─── Cuentas corrientes ─────────────────────────────────────────────────────

export type TransactionType = 'CHARGE' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT'
export type TransactionStatus = 'PENDING' | 'SETTLED' | 'FAILED' | 'VOIDED'

export interface FinancialTransaction {
  id: string
  businessId: string
  customerId: string
  reservationId: string | null
  orderId?: string | null
  stayId?: string | null
  type: TransactionType
  amount: number
  currency: string
  status: TransactionStatus
  notes?: string | null
  createdAt: string
}

// ─── Folio de estadía / Cuentas por cobrar (A1, paso 6) ────────────────────────

export type AccountsReceivableStatus = 'PENDIENTE_FACTURAR' | 'FACTURADO' | 'COBRADO'

export interface AccountReceivable {
  id: string
  businessId: string
  stayId: string
  companyCustomerId: string
  amount: number
  currency: string
  status: AccountsReceivableStatus
  transferredBy: string
  notes?: string | null
  createdAt?: string
  invoicedAt?: string | null
  collectedAt?: string | null
}

export interface AccountsReceivableReportRow {
  companyCustomerId: string
  companyName: string
  count: number
  totalAmount: number
  pendingAmount: number
  invoicedAmount: number
  collectedAmount: number
}
