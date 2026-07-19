'use client'

const BASE = 'https://app-chny.onrender.com'

function getToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('token') ?? ''
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options?.headers,
    },
  })

  if (res.status === 204) return undefined as T

  const data = await res.json()

  if (!res.ok) {
    // Lanza el objeto de error tal como viene de la API
    throw data
  }

  return data as T
}

// Extrae el primer mensaje de error de campo o mensaje general
export function extractErrorMessage(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'Error inesperado'
  const e = err as Record<string, unknown>
  if (e['errors']) {
    const errors = e['errors'] as Record<string, unknown>
    const fieldErrors = errors['fieldErrors'] as Record<string, string[]> | undefined
    if (fieldErrors) {
      const first = Object.values(fieldErrors).flat()[0]
      if (first) return first
    }
    const formErrors = errors['formErrors'] as string[] | undefined
    if (formErrors && formErrors.length > 0) return formErrors[0]
  }
  if (typeof e['message'] === 'string') return e['message']
  return 'Ocurrió un error'
}

// Extrae fieldErrors como mapa { campo: mensaje }
export function extractFieldErrors(err: unknown): Record<string, string> {
  if (typeof err !== 'object' || err === null) return {}
  const e = err as Record<string, unknown>
  const errors = e['errors'] as Record<string, unknown> | undefined
  const fieldErrors = errors?.['fieldErrors'] as Record<string, string[]> | undefined
  if (!fieldErrors) return {}
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([k, v]) => [k, v[0] ?? ''])
  )
}

// ─── Resources ───────────────────────────────────────────────────────────────
import type { Resource, Category, Reservation, Customer } from './types'

export const resourcesApi = {
  list: () => request<Resource[]>('/api/resources'),
  create: (body: Omit<Resource, 'id'> & { id?: string }) =>
    request<Resource>('/api/resources', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Omit<Resource, 'id'> & { id?: string }) =>
    request<Resource>(`/api/resources/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) =>
    request<void>(`/api/resources/${id}`, { method: 'DELETE' }),
}

// ─── Categories ──────────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => request<Category[]>('/api/categories'),
  create: (body: { name: string; description?: string; fields: Category['fields'] }) =>
    request<Category>('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ name: string; description: string; fields: Category['fields']; active: boolean }>) =>
    request<Category>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) =>
    request<void>(`/api/categories/${id}`, { method: 'DELETE' }),
}

// ─── Reservations ────────────────────────────────────────────────────────────
export const reservationsApi = {
  list: () => request<Reservation[]>('/api/reservations'),
  create: (body: { resourceId: string; customer: { id: string }; startTime: string; endTime: string; details?: Record<string, unknown> }) =>
    request<Reservation>('/api/reservations', { method: 'POST', body: JSON.stringify(body) }),
  confirm: (id: string) => request<Reservation>(`/api/reservations/${id}/confirm`, { method: 'POST' }),
  cancel: (id: string) => request<Reservation>(`/api/reservations/${id}/cancel`, { method: 'POST' }),
  complete: (id: string) => request<Reservation>(`/api/reservations/${id}/complete`, { method: 'POST' }),
}

// ─── Customers ───────────────────────────────────────────────────────────────
export const customersApi = {
  findByEmail: (email: string) => request<Customer | null>(`/api/customers?email=${encodeURIComponent(email)}`),
  create: (body: { fullName: string; email: string }) =>
    request<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(body) }),
}
