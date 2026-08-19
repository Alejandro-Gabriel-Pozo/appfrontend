'use client'
import { apiFetch } from '../http'
import type { AfipCredentialsStatus, Invoice } from './types'

// ─── Certificado AFIP (WSAA/WSFEv1) ────────────────────────────────────────
// Cuelga de /api/business-profile porque es config del emisor, pero en un
// endpoint aparte del resto del perfil: es un secreto (cert + clave
// privada), no un dato que viaje entero por GET /api/business-profile.
export const afipCredentialsApi = {
  status: () => apiFetch<AfipCredentialsStatus>('/api/business-profile/afip-credentials/status'),
  save: (body: { cert: string; key: string; environment: 'homologacion' | 'produccion' }) =>
    apiFetch<AfipCredentialsStatus>('/api/business-profile/afip-credentials', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  clear: () => apiFetch<void>('/api/business-profile/afip-credentials', { method: 'DELETE' }),
}

export const invoicesApi = {
  request: (body: { financialTransactionId: string }) =>
    apiFetch<Invoice>('/api/invoices', { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => apiFetch<Invoice>(`/api/invoices/${id}`),
  listByFinancialTransaction: (financialTransactionId: string) =>
    apiFetch<Invoice[]>(`/api/invoices?financialTransactionId=${encodeURIComponent(financialTransactionId)}`),
}
