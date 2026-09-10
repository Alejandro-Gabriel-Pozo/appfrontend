'use client'
import { handleApiResponse } from './api'
import { getPlatformSessionImperative } from '@/context/PlatformAuthContext'

// ─── Cliente propio para /platform/*, no reutiliza apiFetch() de api.ts ───
// apiFetch() manda credentials:'include' (cookie httpOnly de staff) -- eso
// no sirve acá: la sesión de plataforma viaja como Authorization: Bearer
// (no hay cookie, ver PlatformAuthContext.tsx). El parseo de la respuesta y
// el interceptor de sesión vencida SÍ son el mismo código en los dos
// clientes -- eso vive en handleApiResponse() (lib/api.ts, Fase 3,
// docs/auditoria-modularidad.md hallazgo F3), acá solo se le pasa a dónde
// redirigir un 401/TOKEN_EXPIRED (/superadmin/login, no /login).
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

  return handleApiResponse<T>(res, '/superadmin/login')
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

// L (23/08/2026) — `null` en los numéricos = sin límite; arrays vacíos en
// las dos listas de "permitidos" = sin restricción. Mismo criterio que la
// columna/tabla real (platform.schema.sql BLOQUE PLAN_LIMITS) — el
// mapeo a Infinity/'ALL' solo pasa del lado del backend de negocio
// (PlatformRepository.getPlanLimits), no acá.
export interface PlatformPlanLimits {
  plan: string
  maxCategories: number | null
  maxResources: number | null
  maxActiveMemberships: number | null
  maxCustomRoles: number | null
  allowedRoleNames: string[]
  allowedPermissionGroups: string[]
}

export interface PlatformRolePreset {
  name: string
  permissionGroups: string[]
}

// PRESET-REVOKE-001 Parte 2 (10/09/2026) -- el PUT devuelve cuántas filas
// de role_permission_groups tocó la propagación a negocios existentes
// (0 en las dos si el guardado no cambió nada respecto del catálogo).
export interface PlatformRolePresetUpdateResult extends PlatformRolePreset {
  propagatedGranted: number
  propagatedRevoked: number
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

    // L (23/08/2026) — antes el único camino era un UPDATE a mano en la BD central.
    updatePlan: (id: string, plan: string) =>
      platformFetch<{ message: string; business: PlatformBusiness }>(`/platform/businesses/${id}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ plan }),
      }),
  },

  // L (23/08/2026) — editar plan_limits/plan_limit_allowed_roles/
  // plan_limit_allowed_permission_groups. Antes solo por script/migración
  // versionada (pendientes-2026-08-18.md, decisión "no por ahora" del
  // 19/08, reabierta esta sesión).
  planLimits: {
    list: () => platformFetch<PlatformPlanLimits[]>('/platform/plan-limits'),
    update: (plan: string, input: Omit<PlatformPlanLimits, 'plan'>) =>
      platformFetch<PlatformPlanLimits>(`/platform/plan-limits/${plan}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
  },

  // L (23/08/2026) — catálogo global de los 5 roles de fábrica.
  // **Corrección 10/09/2026 (PRESET-REVOKE-001 Parte 1+2, gate
  // architecture-governor)**: editar acá propaga AL INSTANTE, en las DOS
  // direcciones, a TODOS los negocios existentes que tengan ese rol de
  // sistema -- agregar Y sacar, dentro del mismo PUT, no en el próximo
  // arranque. Ya no es asimétrico ni depende de un reinicio del proceso
  // (esa era la versión anterior de este comentario y de la pantalla).
  // Un rol de sistema tampoco se puede customizar por negocio individual
  // (`PUT /api/roles/:id` lo rechaza con 409 desde el mismo bloque) --
  // este catálogo es la ÚNICA vía de cambiar qué puede hacer un rol de
  // fábrica. Ver roles-de-fabrica/page.tsx para el mensaje completo que
  // se le muestra al superadmin.
  rolePresets: {
    list: () => platformFetch<PlatformRolePreset[]>('/platform/role-presets'),
    update: (name: string, permissionGroups: string[]) =>
      platformFetch<PlatformRolePresetUpdateResult>(`/platform/role-presets/${name}`, {
        method: 'PUT',
        body: JSON.stringify({ permissionGroups }),
      }),
  },
}
