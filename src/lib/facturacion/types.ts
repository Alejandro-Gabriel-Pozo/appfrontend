// ─── Facturación Electrónica AFIP, Fase 2 (19/08/2026) ────────────────────────
// Conexión real WSFEv1/WSAA -- app-main/docs/pendientes-2026-08-18.md.
// El cert/clave nunca vuelven del backend (SqlAfipCredentialsRepository los
// cifra y GET /status solo expone si está configurado y en qué ambiente).

export interface AfipCredentialsStatus {
  configured: boolean
  environment: 'homologacion' | 'produccion' | null
}

export type InvoiceStatus = 'PENDING' | 'ISSUED' | 'REJECTED' | 'FAILED_UNCERTAIN'

export interface Invoice {
  id: string
  businessId: string
  financialTransactionId: string
  status: InvoiceStatus
  ptoVta: number
  cbteTipo: number
  cbteNro: number | null
  cae: string | null
  caeVto: string | null
  errorMessage: string | null
  createdAt: string
  issuedAt: string | null
}
