'use client'
import type { ApiErrorWithStatus } from './api'
import { getPlatformSessionImperative } from '@/context/PlatformAuthContext'

// ─── Cliente propio para /platform/*, no reutiliza apiFetch() de api.ts ───
// apiFetch() manda credentials:'include' (cookie httpOnly de staff) y su
// interceptor de 401 redirige hardcodeado a /login -- ninguna de las dos
// cosas sirve acá: la sesión de plataforma viaja como Authorization: Bearer
// (no hay cookie, ver PlatformAuthContext.tsx) y un 401 acá tiene que
// mandar a /superadmin/login, no a la de staff.
const BASE = ''

async function platformFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const session = getPlatformSessionImperative()

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `${session.tokenType} ${session.token}` } : {}),
      ...options?.headers,
    },
  })

  if (res.status === 204) return undefined as T

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err: ApiErrorWithStatus = {
      code:       body?.code    ?? 'INTERNAL_ERROR',
      message:    body?.message ?? 'Error inesperado',
      httpStatus: res.status,
      ...body,
    }

    if ((err.code === 'TOKEN_EXPIRED' || err.code === 'UNAUTHORIZED') && typeof window !== 'undefined') {
      window.location.href = `/superadmin/login?reason=${err.code.toLowerCase()}`
    }

    throw err
  }

  return body as T
}

// ─── Types ──────────────────────────────────────────────────────────────
export interface PlatformBusiness {
  id: string
  name: string
  slug: string
  plan: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'
  ownerEmail: string
  hasTenantDb: boolean
  createdAt: string
  updatedAt: string
}

export interface PlatformLoginResult {
  token: string
  tokenType: 'Bearer'
  expiresIn: number
}

export interface PlatformStats {
  total: number
  active: number
  pending: number
  suspended: number
  cancelled: number
  byPlan: Record<string, number>
  byStatus: Record<string, number>
  generatedAt: string
}

// ─── API ────────────────────────────────────────────────────────────────
export const platformApi = {
  login: (email: string, password: string) =>
    platformFetch<PlatformLoginResult>('/platform/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  stats: () => platformFetch<PlatformStats>('/platform/stats'),

  businesses: {
    list: (filters?: { status?: string; plan?: string }) => {
      const qs = new URLSearchParams()
      if (filters?.status) qs.set('status', filters.status)
      if (filters?.plan)   qs.set('plan', filters.plan)
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      return platformFetch<{ businesses: PlatformBusiness[]; total: number }>(`/platform/businesses${suffix}`)
    },

    updateStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED', reason?: string) =>
      platformFetch<{ message: string; business: PlatformBusiness }>(`/platform/businesses/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      }),

    provision: (id: string) =>
      platformFetch<{ message: string; business: PlatformBusiness }>(`/platform/businesses/${id}/provision`, {
        method: 'POST',
      }),
  },
}
