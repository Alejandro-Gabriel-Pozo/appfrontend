'use client'
import { getTokenImperative } from '@/context/AuthContext'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

if (!BASE && typeof window !== 'undefined') {
  console.error('[api] NEXT_PUBLIC_API_URL no está definida. Configurá la variable de entorno en Vercel.')
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getTokenImperative()}`,
      ...options?.headers,
    },
  })

  if (res.status === 204) return undefined as T

  const data = await res.json()

  if (!res.ok) {
    throw data
  }

  return data as T
}

// ─── Error helpers ───────────────────────────────────────────────────────────
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

// ─── Types ───────────────────────────────────────────────────────────────────
import type {
  Resource, CreateResourceInput, UpdateResourceInput,
  Category,
  Reservation,
  Customer,
  Product, ProductVariant, CreateProductInput, UpdateProductInput, CreateVariantInput, UpdateVariantInput,
} from './types'

// Respuesta paginada genérica
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
}

export interface ReservationFilters {
  page?: number
  limit?: number
  status?: string
  from?: string   // ISO date
  to?: string     // ISO date
}

export interface CustomerListFilters {
  page?: number
  limit?: number
  email?: string
  search?: string
}

// ─── Resources ───────────────────────────────────────────────────────────────
export const resourcesApi = {
  list: () => request<Resource[]>('/api/resources'),
  create: (body: CreateResourceInput) =>
    request<Resource>('/api/resources', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateResourceInput) =>
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
  /**
   * Lista reservas con paginación y filtros opcionales.
   * El backend responde { data, total, page, totalPages } cuando recibe ?page=.
   * Si no se pasa ningún filtro, devuelve array plano (compatibilidad).
   */
  list: (filters: ReservationFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page)   params.set('page',   String(filters.page))
    if (filters.limit)  params.set('limit',  String(filters.limit))
    if (filters.status) params.set('status', filters.status)
    if (filters.from)   params.set('from',   filters.from)
    if (filters.to)     params.set('to',     filters.to)
    const qs = params.toString()
    return request<PaginatedResponse<Reservation> | Reservation[]>(`/api/reservations${qs ? `?${qs}` : ''}`)
  },
  get: (id: string) => request<Reservation>(`/api/reservations/${id}`),
  create: (body: { resourceId: string; customer: { id: string }; startTime: string; endTime: string; details?: Record<string, unknown> }) =>
    request<Reservation>('/api/reservations', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { startTime?: string; endTime?: string; details?: Record<string, unknown> }) =>
    request<Reservation>(`/api/reservations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  confirm: (id: string) => request<Reservation>(`/api/reservations/${id}/confirm`, { method: 'POST' }),
  cancel: (id: string) => request<Reservation>(`/api/reservations/${id}/cancel`, { method: 'POST' }),
  complete: (id: string) => request<Reservation>(`/api/reservations/${id}/complete`, { method: 'POST' }),
}

// ─── Customers ───────────────────────────────────────────────────────────────
export const customersApi = {
  list: (filters: CustomerListFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page)   params.set('page',   String(filters.page))
    if (filters.limit)  params.set('limit',  String(filters.limit))
    if (filters.email)  params.set('email',  filters.email)
    if (filters.search) params.set('search', filters.search)
    const qs = params.toString()
    return request<PaginatedResponse<Customer> | Customer[]>(`/api/customers${qs ? `?${qs}` : ''}`)
  },
  findByEmail: (email: string) =>
    request<Customer | null>(`/api/customers?email=${encodeURIComponent(email)}`),
  create: (body: { fullName: string; email: string }) =>
    request<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(body) }),
}

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsApi = {
  list: () =>
    request<Product[]>('/api/products'),
  get: (id: string) =>
    request<Product>(`/api/products/${id}`),
  create: (body: CreateProductInput) =>
    request<Product>('/api/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateProductInput) =>
    request<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) =>
    request<void>(`/api/products/${id}`, { method: 'DELETE' }),
}

// ─── Product Variants ─────────────────────────────────────────────────────────
export const variantsApi = {
  list: (productId: string) =>
    request<ProductVariant[]>(`/api/products/${productId}/variants`),
  create: (productId: string, body: CreateVariantInput) =>
    request<ProductVariant>(`/api/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(body) }),
  update: (productId: string, variantId: string, body: UpdateVariantInput) =>
    request<ProductVariant>(`/api/products/${productId}/variants/${variantId}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (productId: string, variantId: string) =>
    request<void>(`/api/products/${productId}/variants/${variantId}`, { method: 'DELETE' }),
}
