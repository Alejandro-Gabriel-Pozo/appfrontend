'use client'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

if (!BASE && typeof window !== 'undefined') {
  console.error('[api] NEXT_PUBLIC_API_URL no está definida. Configurá la variable de entorno en Vercel.')
}

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
import type { Resource, Category, Reservation, Customer, Product, ProductVariant, CreateProductInput, UpdateProductInput, CreateVariantInput, UpdateVariantInput } from './types'

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

// ─── Products ─────────────────────────────────────────────────────────────────
// Endpoints:
//   GET    /api/products              → listar todos los productos del tenant
//   POST   /api/products              → crear producto
//   GET    /api/products/:id          → obtener producto por ID
//   PUT    /api/products/:id          → actualizar producto
//   DELETE /api/products/:id          → soft-delete (active = false)

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
// Endpoints:
//   GET    /api/products/:id/variants                            → listar variantes
//   POST   /api/products/:id/variants                            → crear variante
//   PUT    /api/products/:id/variants/:variantId                 → actualizar variante
//   DELETE /api/products/:id/variants/:variantId                 → soft-delete variante

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
