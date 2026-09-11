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
  /** `null` = factura consolidada (C1-Fase C, 23/08/2026) -- cubre N cargos, no una sola FinancialTransaction. */
  financialTransactionId: string | null
  customerId: string
  status: InvoiceStatus
  ptoVta: number
  cbteTipo: number
  cbteNro: number | null
  cae: string | null
  caeVto: string | null
  impTotal: number
  errorMessage: string | null
  createdAt: string
  issuedAt: string | null
}

/**
 * `INVOICE-CHARGES-FACTURACION-SCREEN-01` (11/09/2026) -- `cbteTipoLabel`
 * SOLO viaja en la respuesta de `GET /api/invoices?customerId=`
 * (`invoices.routes.ts`, la única rama que la agrega) -- opcional a
 * propósito, no en `Invoice` base: los otros 4 endpoints que devuelven
 * `Invoice`/`Invoice[]` (`request`, `requestConsolidated`, `get`,
 * `listByFinancialTransaction`) nunca la traen, y declararla requerida en
 * `Invoice` haría que el compilador asuma un campo que en runtime es
 * `undefined` en esos 4 caminos. También queda `undefined` durante la
 * ventana de deploy si el backend viejo (sin este campo) responde antes
 * de que termine de desplegar -- todo consumidor debe usar
 * `?? \`Comprobante tipo ${inv.cbteTipo}\`` como fallback, nunca asumir
 * que está presente.
 */
export interface InvoiceWithLabel extends Invoice {
  cbteTipoLabel?: string
}
