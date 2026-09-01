'use client'
import { apiFetch, extractErrorMessage } from '@/lib/http'
import type { BusinessContext, BusinessContextSource } from './types'

/**
 * Fuentes de `BusinessContext`.
 *
 * Una sola cosa cambia entre desarrollo visual e integración: cuál de estas
 * se le pasa al `BusinessContextProvider`. Las pantallas no se enteran.
 */

// ─────────────────────────────────────────────────────────────────────────
// Mock — SOLO para el banco visual de V3.
//
// Tiene la forma EXACTA del contrato, no una versión simplificada: si el
// mock fuera más pobre que el contrato real, el shell se construiría contra
// una forma que después habría que rehacer, que es justo lo que se quiere
// evitar.
// ─────────────────────────────────────────────────────────────────────────

/** Negocio clasificado, con preset de rubro. El caso normal. */
export const negocioHosteleria: BusinessContext = {
  businessId: 'b-0001',
  industryKey: 'HOSPITALITY',
  industryName: 'Hotelería',
  enabledModules: ['ALOJAMIENTO', 'REPORTES', 'HOUSEKEEPING', 'FACTURACION', 'CUENTAS_CORRIENTES'],
  moduleSources: {
    ALOJAMIENTO: 'PRESET',
    REPORTES: 'PRESET',
    HOUSEKEEPING: 'PRESET',
    FACTURACION: 'SUPERADMIN',
    CUENTAS_CORRIENTES: 'TENANT',
  },
  terminology: {
    'resource.singular': 'Habitación',
    'resource.plural': 'Habitaciones',
    'reservation.singular': 'Reserva',
    'customer.singular': 'Huésped',
    'staff.singular': 'Personal',
  },
  permissionGroups: ['MANAGEMENT', 'FRONT_DESK', 'HOUSEKEEPING_AND_MANAGEMENT'],
  locale: 'es-AR',
  currency: 'ARS',
  timezone: 'America/Argentina/Buenos_Aires',
  reservationNumberPrefix: 'RES',
  customerNumberPrefix: 'CLI',
  // Valores reales de `modules.context_color` en producción (29/08/2026).
  // Emitido para los 6 del catálogo, no sólo los habilitados.
  moduleColors: {
    ALOJAMIENTO: 'BRASS',
    POS_RESTAURANTE: 'CLAY',
    FACTURACION: 'CLAY',
    HOUSEKEEPING: 'SAGE',
    CUENTAS_CORRIENTES: 'NEUTRAL',
    REPORTES: 'NEUTRAL',
  },
}

/**
 * Negocio SIN clasificar — `industryKey: null`.
 *
 * No es `GENERIC`: son los negocios que ya existían antes de que el rubro
 * existiera. Terminología de sistema, módulos tal como estén, y color
 * NEUTRAL en todo. Nada de inferir el rubro (§5.5.3).
 */
export const negocioSinClasificar: BusinessContext = {
  businessId: 'b-0002',
  industryKey: null,
  industryName: null,
  enabledModules: ['REPORTES', 'ALOJAMIENTO'],
  moduleSources: { REPORTES: 'TENANT', ALOJAMIENTO: 'TENANT' },
  terminology: {},   // vacío = cae a las claves del sistema
  permissionGroups: ['MANAGEMENT'],
  locale: 'es-AR',
  currency: 'ARS',
  timezone: 'America/Argentina/Buenos_Aires',
  reservationNumberPrefix: 'RES',
  customerNumberPrefix: 'CLI',
  // Sin clasificar -> NEUTRAL en todo (§5.5.3). La regla vive en
  // `resolveCapabilities()` del backend: con `industryKey === null` aplana
  // todos los colores a NEUTRAL, y `moduleColors` sólo proyecta eso.
  moduleColors: {
    ALOJAMIENTO: 'NEUTRAL',
    POS_RESTAURANTE: 'NEUTRAL',
    FACTURACION: 'NEUTRAL',
    HOUSEKEEPING: 'NEUTRAL',
    CUENTAS_CORRIENTES: 'NEUTRAL',
    REPORTES: 'NEUTRAL',
  },
}

/** Comercio — para ver clay como color de contexto dominante. */
export const negocioComercio: BusinessContext = {
  ...negocioHosteleria,
  businessId: 'b-0003',
  industryKey: 'GASTRONOMIA',
  industryName: 'Gastronomía',
  enabledModules: ['POS_RESTAURANTE', 'REPORTES', 'FACTURACION'],
  moduleSources: { POS_RESTAURANTE: 'PRESET', REPORTES: 'PRESET', FACTURACION: 'PRESET' },
  terminology: {
    'resource.singular': 'Mesa',
    'resource.plural': 'Mesas',
    'reservation.singular': 'Turno',
    'customer.singular': 'Cliente',
  },
  // Prefijo propio, no heredado del spread: si `negocioHosteleria` fuera el
  // único fixture con prefijos reales, el banco visual nunca ejercitaría un
  // valor no-default para `reservationNumberPrefix`.
  reservationNumberPrefix: 'TUR',
  // `moduleColors` viene del spread de `negocioHosteleria`: el color del
  // catálogo no depende del rubro, sólo de `modules.context_color`.
}

/** Fuente de mock, con demora opcional para poder VER el estado `loading`. */
export function mockSource(ctx: BusinessContext, demoraMs = 0): BusinessContextSource {
  return () => new Promise((resolve) => setTimeout(() => resolve(ctx), demoraMs))
}

/** Fuente que falla, para poder ver el estado `error` y su fail-open. */
export function errorSource(mensaje = 'No se pudo cargar el contexto'): BusinessContextSource {
  return () => Promise.reject(new Error(mensaje))
}

// ─────────────────────────────────────────────────────────────────────────
// Fuente real — `GET /api/business/context` (Fase 4 Bloque 4B, `9119a50`).
// ─────────────────────────────────────────────────────────────────────────

// Enums cerrados del contrato. Como `Set<string>` a propósito: `.has(x)` toma
// un `string` directo, sin castear `x` al tipo del enum (la validación es el
// `.has`, no un `as`).
const CONTEXT_COLORS: ReadonlySet<string> = new Set(['BRASS', 'CLAY', 'SAGE', 'NEUTRAL'])
const MODULE_SOURCES: ReadonlySet<string> = new Set(['PRESET', 'SUPERADMIN', 'TENANT'])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isStringOrNull(v: unknown): boolean {
  return v === null || typeof v === 'string'
}
function everyString(v: unknown): boolean {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/**
 * ¿El JSON del endpoint tiene la forma de `BusinessContext`?
 *
 * Valida TIPOS y DOMINIOS de valor: `moduleColors` sólo con `ContextColor`,
 * `moduleSources` sólo con `ModuleSource`, `enabledModules`/`permissionGroups`
 * arrays de string, `terminology` objeto (no-array) de string, `locale` /
 * `currency` / `timezone` string, `industryKey` / `industryName` string|null.
 *
 * LENIENTE con las CLAVES de módulo: si el backend agrega un módulo nuevo al
 * catálogo, el guard no falla — el shell sólo renderiza las claves que su
 * catálogo local conoce. Lo que NO se acepta es un color o una fuente fuera
 * del enum.
 *
 * También LENIENTE con claves de nivel superior que no conoce: no hace
 * `Object.keys(v).length === N`, así que un campo nuevo que el backend
 * agregue después de D6 no rompe este guard (a costa de no detectar una
 * fuga por sí solo — esa responsabilidad es del backend, ver
 * `app-main/src/platform/business-context.routes.test.ts`).
 */
export function isBusinessContext(v: unknown): v is BusinessContext {
  if (!isRecord(v)) return false
  return (
    typeof v.businessId === 'string' &&
    isStringOrNull(v.industryKey) &&
    isStringOrNull(v.industryName) &&
    everyString(v.enabledModules) &&
    isRecord(v.moduleSources) && Object.values(v.moduleSources).every((s) => typeof s === 'string' && MODULE_SOURCES.has(s)) &&
    isRecord(v.moduleColors)  && Object.values(v.moduleColors).every((c) => typeof c === 'string' && CONTEXT_COLORS.has(c)) &&
    isRecord(v.terminology)   && Object.values(v.terminology).every((t) => typeof t === 'string') &&
    everyString(v.permissionGroups) &&
    typeof v.locale === 'string' &&
    typeof v.currency === 'string' &&
    typeof v.timezone === 'string' &&
    typeof v.reservationNumberPrefix === 'string' &&
    typeof v.customerNumberPrefix === 'string'
  )
}

/**
 * Fuente real. `apiFetch` ya hace same-origin, `credentials: 'include'`
 * (cookie httpOnly de sesión), retry en 503 para GET, y redirección a
 * `/login` ante `TOKEN_EXPIRED`/`UNAUTHORIZED`. Acá sólo se agrega:
 *
 * - normalizar la rejección de `apiFetch` (un objeto plano `ApiError`, no un
 *   `Error`) a un `Error` con mensaje legible — si no, el provider haría
 *   `new Error(String(objeto))` = `"[object Object]"`;
 * - rechazar con `Error` legible si el JSON no cumple `isBusinessContext`.
 *
 * Cualquier rejection -> `provider` la mapea a `{ status: 'error' }`
 * (fail-open). Una resolución válida -> `{ status: 'ready' }`.
 */
export function endpointSource(): BusinessContextSource {
  return async (): Promise<BusinessContext> => {
    let raw: unknown
    try {
      raw = await apiFetch<unknown>('/api/business/context')
    } catch (e) {
      throw e instanceof Error ? e : new Error(extractErrorMessage(e))
    }
    if (!isBusinessContext(raw)) {
      throw new Error('GET /api/business/context devolvió un contexto con forma inesperada')
    }
    return raw
  }
}
