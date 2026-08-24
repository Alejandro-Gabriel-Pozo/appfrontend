'use client'
import { apiFetch } from '../http'
import type { PaginatedResponse } from '../http'
import type { FinancialTransaction, OutstandingInvoice, BillingPolicy, UpsertBillingPolicyInput } from '../finanzas/types'
import type {
  Customer, CustomerRate, CustomerStatement, CustomerListFilters,
  CustomerTaxProfile, UpsertCustomerTaxProfileInput, TaxpayerLookupResult,
} from './types'

// ─── Customers ────────────────────────────────────────────────────────────────
export const customersApi = {
  list: (filters: CustomerListFilters = {}) => {
    // A7.2 (23/08/2026) — `search` es nombre/email tipeado por el usuario,
    // PII: nunca en query string. Mismo criterio que searchByTaxId más
    // abajo — un POST separado en vez de sumarlo a la query de arriba.
    if (filters.search) {
      return apiFetch<PaginatedResponse<Customer> | Customer[]>('/api/customers/search', {
        method: 'POST',
        body: JSON.stringify({
          search: filters.search,
          ...(filters.currentAccountEnabled && { currentAccountEnabled: true }),
          ...(filters.page  !== undefined && { page: filters.page }),
          ...(filters.limit !== undefined && { limit: filters.limit }),
        }),
      })
    }
    const params = new URLSearchParams()
    if (filters.page)   params.set('page',   String(filters.page))
    if (filters.limit)  params.set('limit',  String(filters.limit))
    if (filters.email)  params.set('email',  filters.email)
    if (filters.currentAccountEnabled) params.set('currentAccountEnabled', 'true')
    const qs = params.toString()
    return apiFetch<PaginatedResponse<Customer> | Customer[]>(
      `/api/customers${qs ? `?${qs}` : ''}`,
    )
  },
  findByEmail: (email: string) =>
    apiFetch<Customer | null>(`/api/customers?email=${encodeURIComponent(email)}`),
  /** G1 (23/08/2026) — busca contra los perfiles fiscales ya cargados (no el padrón de ARCA). Body, nunca query string (A7.2, el CUIT/DNI es PII). */
  searchByTaxId: (taxId: string) =>
    apiFetch<Customer[]>('/api/customers/search-by-tax-id', { method: 'POST', body: JSON.stringify({ taxId }) }),
  get: (id: string) => apiFetch<Customer>(`/api/customers/${id}`),
  create: (body: { fullName: string; email: string }) =>
    apiFetch<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ displayName: string; kind: 'INDIVIDUAL' | 'COMPANY'; active: boolean; enableCurrentAccount: boolean }>) =>
    apiFetch<Customer>(`/api/customers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  addTag: (id: string, tagName: string) =>
    apiFetch<Customer>(`/api/customers/${id}/tags`, { method: 'POST', body: JSON.stringify({ tagName }) }),
  removeTag: (id: string, tagId: string) =>
    apiFetch<void>(`/api/customers/${id}/tags/${tagId}`, { method: 'DELETE' }),
}

// ─── Tarifas especiales ──────────────────────────────────────────────────────
export const customerRatesApi = {
  list: (customerId: string) => apiFetch<CustomerRate[]>(`/api/customers/${customerId}/rates`),
  create: (customerId: string, body: { resourceId?: string; serviceId?: string; price: number; notes?: string }) =>
    apiFetch<CustomerRate>(`/api/customers/${customerId}/rates`, { method: 'POST', body: JSON.stringify(body) }),
  remove: (customerId: string, rateId: string) =>
    apiFetch<void>(`/api/customers/${customerId}/rates/${rateId}`, { method: 'DELETE' }),
}

// ─── Cuentas corrientes ──────────────────────────────────────────────────────
export const customerAccountApi = {
  getStatement: (customerId: string) => apiFetch<CustomerStatement>(`/api/customers/${customerId}/account`),
  /** I4 (23/08/2026) — facturas ISSUED con saldo pendiente, para el modal de conciliación de "Registrar Pago". */
  getOutstandingInvoices: (customerId: string) =>
    apiFetch<OutstandingInvoice[]>(`/api/customers/${customerId}/outstanding-invoices`),
  /** `allocations` (I4) — qué factura(s) salda este pago. Omitido = pago sin destino, comportamiento previo. Devuelve siempre un array. */
  recordPayment: (customerId: string, body: {
    amount: number
    idempotencyKey?: string
    notes?: string
    allocations?: { invoiceId: string; amount: number }[]
  }) =>
    apiFetch<FinancialTransaction[]>(`/api/customers/${customerId}/payments`, { method: 'POST', body: JSON.stringify(body) }),
}

// ─── Perfil fiscal (19/08/2026) ─────────────────────────────────────────────
// Gateado por el módulo Facturación del lado del backend -- un 402
// MODULE_NOT_ENABLED es esperable si el negocio no lo tiene habilitado,
// no un error real (mismo criterio que FacturarButton.tsx).
export const customerTaxProfileApi = {
  get: (customerId: string) => apiFetch<CustomerTaxProfile | null>(`/api/customers/${customerId}/tax-profile`),
  upsert: (customerId: string, body: UpsertCustomerTaxProfileInput) =>
    apiFetch<CustomerTaxProfile>(`/api/customers/${customerId}/tax-profile`, { method: 'PUT', body: JSON.stringify(body) }),
}

// ─── BillingPolicy (C1-Fase C, 23/08/2026) ─────────────────────────────────
// Mismo criterio de gating que customerTaxProfileApi (módulo Facturación).
export const billingPolicyApi = {
  get: (customerId: string) => apiFetch<BillingPolicy | null>(`/api/customers/${customerId}/billing-policy`),
  upsert: (customerId: string, body: UpsertBillingPolicyInput) =>
    apiFetch<BillingPolicy>(`/api/customers/${customerId}/billing-policy`, { method: 'PUT', body: JSON.stringify(body) }),
}

// ─── Padrón de ARCA — autocompletar datos fiscales ─────────────────────────
export const padronApi = {
  lookupByCuit: (cuit: string) =>
    apiFetch<TaxpayerLookupResult | null>('/api/customers/padron/lookup-by-cuit', { method: 'POST', body: JSON.stringify({ cuit }) }),
  lookupByDni: (dni: string) =>
    apiFetch<{ cuit: string | null }>('/api/customers/padron/lookup-by-dni', { method: 'POST', body: JSON.stringify({ dni }) }),
}
