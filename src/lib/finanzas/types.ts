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
  /** I4 (23/08/2026) — solo en type='PAYMENT': qué factura salda este pago (conciliación). Null = pago sin destino. */
  settledInvoiceId?: string | null
  createdAt: string
}

/** I4 (23/08/2026) — factura ISSUED con saldo pendiente, para el modal de conciliación de "Registrar Pago". */
export interface OutstandingInvoice {
  invoiceId: string
  cbteTipo: number
  cbteNro: number | null
  impTotal: number
  outstanding: number
  issuedAt: string | null
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
