'use client'
import { apiFetch } from '../http'
import type { AccountReceivable } from './types'

// ─── Cuentas por cobrar (F1-Pieza 3, 23/08/2026) ───────────────────────────
// La creación de la fila vive en staysApi.transferToReceivable (lib/estadias/api.ts,
// ya existía) — esto es el ciclo de vida posterior: listar y avanzar de estado.
export const accountsReceivableApi = {
  listByCompany: (companyCustomerId: string) =>
    apiFetch<AccountReceivable[]>(`/api/accounts-receivable?companyCustomerId=${encodeURIComponent(companyCustomerId)}`),
  /** PENDIENTE_FACTURAR → FACTURADO. Solo cambia el estado, no toca el ledger. invoiceRef = N° de comprobante anotado a mano, opcional. */
  markInvoiced: (id: string, invoiceRef?: string) =>
    apiFetch<AccountReceivable>(`/api/accounts-receivable/${id}/mark-invoiced`, {
      method: 'POST',
      ...(invoiceRef && { body: JSON.stringify({ invoiceRef }) }),
    }),
  /** FACTURADO → COBRADO. Crea el PAYMENT que cierra la deuda de la empresa. */
  markCollected: (id: string) =>
    apiFetch<AccountReceivable>(`/api/accounts-receivable/${id}/mark-collected`, { method: 'POST' }),
}
