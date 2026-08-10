'use client'
import { getTokenImperative } from '@/context/AuthContext'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

if (!BASE && typeof window !== 'undefined') {
  console.error(
    '[api] NEXT_PUBLIC_API_URL no está definida. Configurá la variable de entorno.',
  )
}

// ─── Tipos de error públicos ──────────────────────────────────────────────────
export type ApiError =
  | { code: 'PLAN_LIMIT_REACHED'; message: string; plan: string; limit: number }
  | { code: 'VALIDATION_ERROR';   message: string; errors: ZodFlatErrors }
  | { code: 'PLATFORM_UNAVAILABLE'; message: string }
  | { code: 'UNAUTHORIZED' | 'TOKEN_EXPIRED'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'INTERNAL_ERROR'; message: string }
  | { code: string; message: string }

export type ApiErrorWithStatus = ApiError & { httpStatus: number }

export interface ZodFlatErrors {
  fieldErrors: Record<string, string[]>
  formErrors:  string[]
}

// ─── Retry con backoff exponencial para cold starts de Render (503) ───────────
// Solo reintenta en 503 (Service Unavailable) y errores de red.
// No reintenta en 4xx (errores del cliente) ni en mutaciones peligrosas.
const RETRYABLE_METHODS = new Set(['GET', 'HEAD'])
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1_500  // 1.5s → 3s → 6s

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Función central de llamadas ─────────────────────────────────────────────
export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase()
  const canRetry = RETRYABLE_METHODS.has(method)

  let attempt = 0

  while (true) {
    let res: Response
    try {
      res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getTokenImperative()}`,
          ...options?.headers,
        },
      })
    } catch (networkErr) {
      // Error de red (offline, ECONNREFUSED, etc.)
      if (canRetry && attempt < MAX_RETRIES) {
        attempt++
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
        console.warn(`[api] Error de red en ${path} — reintento ${attempt}/${MAX_RETRIES} en ${delay}ms`)
        await sleep(delay)
        continue
      }
      throw networkErr
    }

    // 503 Service Unavailable — Render cold start
    if (res.status === 503 && canRetry && attempt < MAX_RETRIES) {
      attempt++
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`[api] 503 en ${path} — reintento ${attempt}/${MAX_RETRIES} en ${delay}ms (cold start)`)
      await sleep(delay)
      continue
    }

    // 204 No Content — éxito sin cuerpo
    if (res.status === 204) return undefined as T

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      const err: ApiErrorWithStatus = {
        code:       body?.code    ?? 'INTERNAL_ERROR',
        message:    body?.message ?? 'Error inesperado',
        httpStatus: res.status,
        ...body,
      }

      // Interceptor global: token expirado o sin autenticación
      if (
        (err.code === 'TOKEN_EXPIRED' || err.code === 'UNAUTHORIZED') &&
        typeof window !== 'undefined'
      ) {
        window.location.href = `/login?reason=${err.code.toLowerCase()}`
      }

      throw err
    }

    return body as T
  }
}

// ─── Error helpers ────────────────────────────────────────────────────────────
export function extractErrorMessage(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'Error inesperado'
  const e = err as Record<string, unknown>
  if (e['errors']) {
    const errors     = e['errors'] as Record<string, unknown>
    const fieldErrors = errors['fieldErrors'] as Record<string, string[]> | undefined
    if (fieldErrors) {
      const first = Object.values(fieldErrors).flat()[0]
      if (first) return first
    }
    const formErrors = errors['formErrors'] as string[] | undefined
    if (formErrors?.length) return formErrors[0]
  }
  if (typeof e['message'] === 'string') return e['message']
  return 'Ocurrió un error'
}

export function extractFieldErrors(err: unknown): Record<string, string> {
  if (typeof err !== 'object' || err === null) return {}
  const e          = err as Record<string, unknown>
  const errors     = e['errors'] as Record<string, unknown> | undefined
  const fieldErrors = errors?.['fieldErrors'] as Record<string, string[]> | undefined
  if (!fieldErrors) return {}
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([k, v]) => [k, v[0] ?? ''])
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
import type {
  Resource, CreateResourceInput, UpdateResourceInput,
  Category,
  Reservation,
  Customer,
  Product, ProductVariant, CreateProductInput, UpdateProductInput,
  CreateVariantInput, UpdateVariantInput,
  Order, OrderItem, CreateOrderInput, ListOrdersFilters,
} from './types'

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
}

export interface ReservationFilters {
  page?:   number
  limit?:  number
  status?: string
  from?:   string
  to?:     string
}

export interface CustomerListFilters {
  page?:   number
  limit?:  number
  email?:  string
  search?: string
}

// ─── Resources ────────────────────────────────────────────────────────────────
export const resourcesApi = {
  list:   ()                              => apiFetch<Resource[]>('/api/resources'),
  create: (body: CreateResourceInput)     => apiFetch<Resource>('/api/resources', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateResourceInput) =>
    apiFetch<Resource>(`/api/resources/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string)                   => apiFetch<void>(`/api/resources/${id}`, { method: 'DELETE' }),
}

// ─── Categories ───────────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => apiFetch<Category[]>('/api/categories'),
  create: (body: { name: string; description?: string; fields: Category['fields'] }) =>
    apiFetch<Category>('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ name: string; description: string; fields: Category['fields']; active: boolean }>) =>
    apiFetch<Category>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) =>
    apiFetch<void>(`/api/categories/${id}`, { method: 'DELETE' }),
}

// ─── Reservations ─────────────────────────────────────────────────────────────
export const reservationsApi = {
  list: (filters: ReservationFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page)   params.set('page',   String(filters.page))
    if (filters.limit)  params.set('limit',  String(filters.limit))
    if (filters.status) params.set('status', filters.status)
    if (filters.from)   params.set('from',   filters.from)
    if (filters.to)     params.set('to',     filters.to)
    const qs = params.toString()
    return apiFetch<PaginatedResponse<Reservation> | Reservation[]>(
      `/api/reservations${qs ? `?${qs}` : ''}`,
    )
  },
  get:      (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}`),
  create: (body: { resourceId: string; customer: { id: string }; startTime: string; endTime: string; details?: Record<string, unknown> }) =>
    apiFetch<Reservation>('/api/reservations', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { startTime?: string; endTime?: string; details?: Record<string, unknown> }) =>
    apiFetch<Reservation>(`/api/reservations/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  confirm:  (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}/confirm`,  { method: 'POST' }),
  cancel:   (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}/cancel`,   { method: 'POST' }),
  complete: (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}/complete`, { method: 'POST' }),
}

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
  create: (body: { fullName: string; email: string }) =>
    apiFetch<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(body) }),
}

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsApi = {
  list:   ()                          => apiFetch<Product[]>('/api/products'),
  get:    (id: string)                => apiFetch<Product>(`/api/products/${id}`),
  create: (body: CreateProductInput)  => apiFetch<Product>('/api/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateProductInput) =>
    apiFetch<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string)                => apiFetch<void>(`/api/products/${id}`, { method: 'DELETE' }),
}

// ─── Product Variants ─────────────────────────────────────────────────────────
export const variantsApi = {
  list: (productId: string) =>
    apiFetch<ProductVariant[]>(`/api/products/${productId}/variants`),
  create: (productId: string, body: CreateVariantInput) =>
    apiFetch<ProductVariant>(`/api/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(body) }),
  update: (productId: string, variantId: string, body: UpdateVariantInput) =>
    apiFetch<ProductVariant>(`/api/products/${productId}/variants/${variantId}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (productId: string, variantId: string) =>
    apiFetch<void>(`/api/products/${productId}/variants/${variantId}`, { method: 'DELETE' }),
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (filters: ListOrdersFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.customerId)     params.set('customerId', filters.customerId)
    if (filters.status)         params.set('status',     filters.status)
    if (filters.from)           params.set('from',       filters.from)
    if (filters.to)             params.set('to',         filters.to)
    if (filters.limit  != null) params.set('limit',      String(filters.limit))
    if (filters.offset != null) params.set('offset',     String(filters.offset))
    const qs = params.toString()
    return apiFetch<Order[]>(`/api/orders${qs ? `?${qs}` : ''}`)
  },
  get:         (id: string)                    => apiFetch<Order>(`/api/orders/${id}`),
  create:      (body: CreateOrderInput)        => apiFetch<Order>('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  confirm:     (id: string)                    => apiFetch<Order>(`/api/orders/${id}/confirm`,  { method: 'POST' }),
  complete:    (id: string)                    => apiFetch<Order>(`/api/orders/${id}/complete`, { method: 'POST' }),
  cancel:      (id: string)                    => apiFetch<Order>(`/api/orders/${id}/cancel`,   { method: 'POST' }),
  updateNotes: (id: string, notes: string | null) =>
    apiFetch<Order>(`/api/orders/${id}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
  addItem: (id: string, body: { itemType: string; productId?: string | null; productVariantId?: string | null; reservationId?: string | null; quantity: number; unitPrice: number }) =>
    apiFetch<OrderItem>(`/api/orders/${id}/items`, { method: 'POST', body: JSON.stringify(body) }),
  removeItem: (id: string, itemId: string) =>
    apiFetch<void>(`/api/orders/${id}/items/${itemId}`, { method: 'DELETE' }),
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export interface OccupancyReport {
  resourceId:   string
  resourceName: string
  totalSlots:   number
  bookedSlots:  number
  occupancyPct: number
}

export interface OccupancySummary {
  from:      string
  to:        string
  topResources: OccupancyReport[]
}

export interface UnderutilizedResource {
  resourceId:   string
  resourceName: string
  occupancyPct: number
}

export const reportsApi = {
  occupancy: (from: string, to: string) => {
    const params = new URLSearchParams({ from, to })
    return apiFetch<OccupancyReport[]>(`/api/reports/occupancy?${params}`)
  },
  summary: (from: string, to: string, limit = 5) => {
    const params = new URLSearchParams({ from, to, limit: String(limit) })
    return apiFetch<OccupancySummary>(`/api/reports/occupancy/summary?${params}`)
  },
  underutilized: (from: string, to: string, threshold = 30) => {
    const params = new URLSearchParams({ from, to, threshold: String(threshold) })
    return apiFetch<UnderutilizedResource[]>(`/api/reports/underutilized?${params}`)
  },
}
