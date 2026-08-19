'use client'
import { extractErrorMessage, extractFieldErrors, type ApiErrorWithStatus } from './api'
import type {
  Category,
  BookableService,
  Reservation,
  AvailabilitySearchResult,
} from './types'

// Re-exportados para que las páginas del portal no tengan que importar de
// dos módulos distintos para manejar errores.
export { extractErrorMessage, extractFieldErrors }
export type { ApiErrorWithStatus }

// Vacío a propósito: /api/* se pide same-origin y next.config.js lo
// reenvía server-side a NEXT_PUBLIC_API_URL (ver comentario ahí — B2).
const BASE = ''

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

/** Extrae el slug del negocio de la URL actual (`/portal/{slug}/...`) — reemplaza a `session.businessSlug`. */
function slugFromLocation(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return window.location.pathname.match(/^\/portal\/([^/]+)/)?.[1]
}

// ─── Fetch autenticado del dominio de clientes ────────────────────────────────
// Se usa tanto para /api/customer/me* como para los endpoints generales que
// el rol CUSTOMER puede leer (Roles.BOOKING incluye CUSTOMER):
// /api/categories y /api/bookable-services*.
//
// Cookie httpOnly (19/08/2026) — ya no arma el header Authorization a mano
// (no hay token legible del lado del cliente): `credentials: 'include'`
// manda la cookie `rh_customer_token` sola, como ya hacía apiFetch (lib/api.ts)
// para el panel de staff.
export async function customerApiFetch<T>(
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
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
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
      // DE ESTE portal (slug tomado de la URL actual, ya no de una sesión
      // guardada), nunca al /login de staff — son dominios de auth separados.
      if (
        (err.code === 'TOKEN_EXPIRED' || err.code === 'UNAUTHORIZED') &&
        typeof window !== 'undefined'
      ) {
        const slug = slugFromLocation()
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

// credentials: 'include' acá también — register/login/login-google setean
// la cookie httpOnly en su response (Set-Cookie), el browser solo la guarda
// si el fetch pide credenciales.
async function publicFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
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
  // Punto 5/E5 (15/08/2026) — self-service: si el email no existe todavía
  // se auto-crea, y si ya existe (cargado a mano por el negocio, o
  // registrado antes por password) se vincula en vez de duplicar.
  loginWithGoogle: (slug: string, idToken: string) =>
    publicFetch<CustomerAuthResponse>(`/api/customer/${slug}/login/google`, {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),
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
