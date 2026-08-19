'use client'
import { apiFetch } from '../http'
import type { AccountReceivable } from '../finanzas/types'
import type { Stay, CheckInInput, CheckOutInput, StayFolio } from './types'

// ─── Stays (check-in / check-out) ────────────────────────────────────────────────
export const staysApi = {
  listActive: () => apiFetch<Stay[]>('/api/stays'),
  checkIn: (body: CheckInInput) => apiFetch<Stay>('/api/stays/check-in', { method: 'POST', body: JSON.stringify(body) }),
  checkOut: (id: string, body: CheckOutInput = {}) =>
    apiFetch<Stay>(`/api/stays/${id}/check-out`, { method: 'POST', body: JSON.stringify(body) }),
  noShow: (id: string) => apiFetch<Stay>(`/api/stays/${id}/no-show`, { method: 'POST' }),
  /** Saldo + transacciones de la estadía (A1, paso 6) — se consulta antes de intentar el check-out. */
  getFolio: (id: string) => apiFetch<StayFolio>(`/api/stays/${id}/folio`),
  /** Transfiere el saldo pendiente a cuenta por cobrar de una empresa. Solo MANAGEMENT (backend lo valida igual). */
  transferToReceivable: (id: string, body: { companyCustomerId: string; notes?: string }) =>
    apiFetch<AccountReceivable>(`/api/stays/${id}/transfer-to-receivable`, { method: 'POST', body: JSON.stringify(body) }),
}
