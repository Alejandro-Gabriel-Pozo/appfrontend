'use client'
import { apiFetch } from '../http'
import type { PaginatedResponse } from '../http'
import type { FinancialTransaction } from '../finanzas/types'
import type { Customer, CustomerRate, CustomerStatement, CustomerListFilters } from './types'

// ─── Customers ────────────────────────────────────────────────────────────────
export const customersApi = {
  list: (filters: CustomerListFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page)   params.set('page',   String(filters.page))
    if (filters.limit)  params.set('limit',  String(filters.limit))
    if (filters.email)  params.set('email',  filters.email)
    if (filters.search) params.set('search', filters.search)
    const qs = params.toString()
    return apiFetch<PaginatedResponse<Customer> | Customer[]>(
      `/api/customers${qs ? `?${qs}` : ''}`,
    )
  },
  findByEmail: (email: string) =>
    apiFetch<Customer | null>(`/api/customers?email=${encodeURIComponent(email)}`),
  get: (id: string) => apiFetch<Customer>(`/api/customers/${id}`),
  create: (body: { fullName: string; email: string }) =>
    apiFetch<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ displayName: string; kind: 'INDIVIDUAL' | 'COMPANY'; active: boolean }>) =>
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
  recordPayment: (customerId: string, body: { amount: number; idempotencyKey?: string; notes?: string }) =>
    apiFetch<FinancialTransaction>(`/api/customers/${customerId}/payments`, { method: 'POST', body: JSON.stringify(body) }),
}
