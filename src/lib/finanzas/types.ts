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
  /** F1-Pieza 2 (23/08/2026) — derivado (JOIN a reservations), solo si reservationId está seteado. Null si no hay reserva de origen. */
  reservationNumber?: number | null
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

// REVERTIDO agregado 14/09/2026 (Bloque 3c-iii, app-main) -- mismo modo de
// falla que ROLES-CATALOG-DRIFT-001: el backend agregó este 4º estado a
// `AccountsReceivableStatus` en app-main/src/clientes-finanzas/
// accounts-receivable.repository.ts (Bloque 3c-ii, `reverseTransfer()`)
// y este catálogo quedó atrás -- precondición dura del gate
// `architecture-governor` de implementación antes de exponer la ruta
// `POST /:id/reverse`. Ver también AR_STATUS_LABEL más abajo en
// dashboard/reportes/page.tsx, que sin esto renderizaba una celda en
// blanco para toda fila revertida.
export type AccountsReceivableStatus = 'PENDIENTE_FACTURAR' | 'FACTURADO' | 'COBRADO' | 'REVERTIDO'

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
  /** F1-Pieza 3 (23/08/2026) — N° de comprobante anotado a mano al marcar "Facturado". No genera ninguna factura real en este alcance. */
  invoiceRef?: string | null
}

/**
 * H-A (05/09/2026) — respuesta de `markCollected()` cuando detecta que la
 * factura vinculada ya estaba cubierta parcial o totalmente por otro
 * camino de cobro. `collection` es aditivo, no persistido -- solo viaja en
 * la llamada que detecta la colisión; un reintento devuelve
 * `AccountReceivable` sin este campo (no es idempotente en contenido, ver
 * docblock del backend).
 */
export interface AccountReceivableMarkCollectedResult extends AccountReceivable {
  collection?: {
    invoiceId: string
    appliedAmount: number
    excessAmount: number
  }
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

// ─── BillingPolicy (C1-Fase C, 23/08/2026) ─────────────────────────────────
// Sin fila = política default (requiere seña si hay una configurada,
// factura por reserva, vence al momento). requiresSenaToConfirm/
// invoicingTrigger/cycleFrequency se guardan pero hoy no tienen ningún
// efecto en el sistema todavía -- ver docblock del backend.

export type InvoicingScope = 'per_reservation' | 'consolidated'
export type InvoicingTrigger = 'on_completion' | 'scheduled'
export type CycleFrequency = 'weekly' | 'monthly' | 'custom_days'

export interface BillingPolicy {
  customerId: string
  requiresSenaToConfirm: boolean
  invoicingScope: InvoicingScope
  invoicingTrigger: InvoicingTrigger
  cycleFrequency: CycleFrequency | null
  cycleCustomDays: number | null
  dueDays: number
  updatedAt: string
}

export interface UpsertBillingPolicyInput {
  requiresSenaToConfirm: boolean
  invoicingScope: InvoicingScope
  invoicingTrigger: InvoicingTrigger
  cycleFrequency?: CycleFrequency | null
  cycleCustomDays?: number | null
  dueDays: number
}
