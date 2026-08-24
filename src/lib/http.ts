'use client'

// Vacío a propósito: /api/* se pide same-origin y next.config.js lo
// reenvía server-side a NEXT_PUBLIC_API_URL (ver comentario ahí — B2).
const BASE = ''

// ─── Tipos de error públicos ──────────────────────────────────────────────────
export type ApiError =
  | { code: 'PLAN_LIMIT_REACHED'; message: string; plan: string; limit: number }
  // L (23/08/2026) — techo de permisos de un rol CUSTOM por plan (usuarios-roles/roles.routes.ts).
  | { code: 'PERMISSION_GROUP_NOT_AVAILABLE_IN_PLAN'; message: string; plan: string; permissionGroups: string[] }
  | { code: 'MODULE_NOT_ENABLED'; message: string; module: string }
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

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
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

/**
 * Parseo de respuesta + interceptor de sesión vencida, compartido entre
 * `apiFetch()` (acá abajo, cookie httpOnly de staff) y `platformFetch()`
 * (lib/platformApi.ts, Authorization Bearer de superadmin) — Fase 3,
 * docs/auditoria-modularidad.md, hallazgo F3. Lo único que de verdad
 * distingue a los dos clientes es CÓMO arman el `fetch()` (credenciales,
 * reintento con backoff) y A DÓNDE redirige un 401/TOKEN_EXPIRED — eso
 * sigue siendo responsabilidad de cada uno, se le pasa acá como parámetro.
 */
export async function handleApiResponse<T>(res: Response, loginPath: string): Promise<T> {
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
      window.location.href = `${loginPath}?reason=${err.code.toLowerCase()}`
    }

    throw err
  }

  return body as T
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
        // La cookie httpOnly de sesión (B2) viaja sola en cada fetch
        // same-origin — no hace falta armar un header Authorization a mano.
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
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

    return handleApiResponse<T>(res, '/login')
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
