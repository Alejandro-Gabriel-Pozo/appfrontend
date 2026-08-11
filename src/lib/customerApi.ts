'use client'
import { getCustomerSessionImperative } from '@/context/CustomerAuthContext'
import { extractErrorMessage, extractFieldErrors, type ApiErrorWithStatus } from './api'
import type {
  Category,
  BookableService,
  Reservation,
  CustomerSession,
  AvailabilitySearchResult,
} from './types'

// Re-exportados para que las páginas del portal no tengan que importar de
// dos módulos distintos para manejar errores.
export { extractErrorMessage, extractFieldErrors }
export type { ApiErrorWithStatus }

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

if (!BASE && typeof window !== 'undefined') {
  console.error(
    '[customerApi] NEXT_PUBLIC_API_URL no está definida. Configurá la variable de entorno.',
  )
}

// ─── Retry con backoff exponencial para cold starts de Render (503) ───────────
// Misma lógica que lib/api.ts — solo GET/HEAD, mismos tiempos de espera.
const RETRYABLE_METHODS = new Set(['GET', 'HEAD'])
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1_500 // 1.5s → 3s → 6s

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => ({}))
}

function buildApiError(body: unknown, status: number): ApiErrorWithStatus {
  const b = (body ?? {}) as Record<string, unknown>
  return {
    code: (b.code as string) ?? 'INTERNAL_ERROR',
    message: (b.message as string) ?? 'Error inesperado',
    httpStatus: status,
    ...b,
  } as ApiErrorWithStatus
}

// ─── Fetch autenticado del dominio de clientes ────────────────────────────────
// Se usa tanto para /api/customer/me* como para los endpoints generales que
// el rol CUSTOMER puede leer (Roles.BOOKING incluye CUSTOMER):
// /api/categories y /api/bookable-services*.
export async function customerApiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase()
  const canRetry = RETRYABLE_METHODS.has(method)
  const session = getCustomerSessionImperative()

  let attempt = 0

  while (true) {
    let res: Response
    try {
      res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.token ?? ''}`,
          ...options?.headers,
        },
      })
    } catch (networkErr) {
      if (canRetry && attempt < MAX_RETRIES) {
        attempt++
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
        console.warn(`[customerApi] Error de red en ${path} — reintento ${attempt}/${MAX_RETRIES} en ${delay}ms`)
        await sleep(delay)
        continue
      }
      throw networkErr
    }

    if (res.status === 503 && canRetry && attempt < MAX_RETRIES) {
      attempt++
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`[customerApi] 503 en ${path} — reintento ${attempt}/${MAX_RETRIES} en ${delay}ms (cold start)`)
      await sleep(delay)
      continue
    }

    if (res.status === 204) return undefined as T

    const body = await parseJson(res)

    if (!res.ok) {
      const err = buildApiError(body, res.status)

      // Interceptor: token de cliente vencido o ausente. Redirige al login
      // DE ESTE portal (con el slug guardado en la sesión), nunca al /login
      // de staff — son dominios de auth separados.
      if (
        (err.code === 'TOKEN_EXPIRED' || err.code === 'UNAUTHORIZED') &&
        typeof window !== 'undefined'
      ) {
        const slug = session?.businessSlug
        window.location.href = slug
          ? `/portal/${slug}/login?reason=${err.code.toLowerCase()}`
          : '/portal'
      }

      throw err
    }

    return body as T
  }
}

// ─── Auth pública (sin token) ─────────────────────────────────────────────────
interface CustomerAuthResponse {
  token: string
  tokenType: 'Bearer'
  customer: { id: string; fullName: string; email: string }
}

async function publicFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  const body = await parseJson(res)
  if (!res.ok) throw buildApiError(body, res.status)
  return body as T
}

export const customerAuthApi = {
  register: (slug: string, body: { fullName: string; email: string; password: string }) =>
    publicFetch<CustomerAuthResponse>(`/api/customer/${slug}/register`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (slug: string, body: { email: string; password: string }) =>
    publicFetch<CustomerAuthResponse>(`/api/customer/${slug}/login`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

/** Convierte una respuesta de auth + slug en la sesión persistible en CustomerAuthContext. */
export function toCustomerSession(res: CustomerAuthResponse, businessSlug: string): CustomerSession {
  return { token: res.token, customer: res.customer, businessSlug }
}

// ─── Disponibilidad (pública) ──────────────────────────────────────────────────
export const availabilityApi = {
  search: (slug: string, params: { startTime: string; endTime: string; categoryId?: string }) => {
    const qs = new URLSearchParams({ startTime: params.startTime, endTime: params.endTime })
    if (params.categoryId) qs.set('categoryId', params.categoryId)
    return publicFetch<AvailabilitySearchResult>(`/api/customer/${slug}/availability?${qs}`)
  },
}

// ─── Mis reservas ──────────────────────────────────────────────────────────────
export interface CreateCustomerReservationInput {
  categoryId: string
  resourceId: string
  serviceId?: string
  startTime: string
  /** Requerido solo si no se manda serviceId — la duración fija de un servicio no es editable. */
  endTime?: string
  details?: Record<string, unknown>
}

export interface UpdateCustomerReservationInput {
  startTime?: string
  endTime?: string
  details?: Record<string, unknown>
}

export const customerReservationsApi = {
  list: () => customerApiFetch<Reservation[]>('/api/customer/me/reservations'),
  create: (body: CreateCustomerReservationInput) =>
    customerApiFetch<Reservation>('/api/customer/me/reservations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: UpdateCustomerReservationInput) =>
    customerApiFetch<Reservation>(`/api/customer/me/reservations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  cancel: (id: string) =>
    customerApiFetch<Reservation>(`/api/customer/me/reservations/${id}/cancel`, { method: 'POST' }),
}

// ─── Mi cuenta ───────────────────────────────────────────────────────────────
export const customerAccountApi = {
  me: () => customerApiFetch<{ id: string; fullName: string; email: string }>('/api/customer/me'),
  deleteAccount: () => customerApiFetch<void>('/api/customer/me', { method: 'DELETE' }),
}

// ─── Endpoints generales de solo lectura (Roles.BOOKING incluye CUSTOMER) ─────
export const customerCategoriesApi = {
  list: () => customerApiFetch<Category[]>('/api/categories'),
}

export const customerBookableServicesApi = {
  list: () => customerApiFetch<BookableService[]>('/api/bookable-services'),
}
