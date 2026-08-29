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
    'booking.singular': 'Reserva',
    'customer.singular': 'Huésped',
    'staff.singular': 'Personal',
  },
  permissionGroups: ['MANAGEMENT', 'FRONT_DESK', 'HOUSEKEEPING_AND_MANAGEMENT'],
  locale: 'es-AR',
  currency: 'ARS',
  timezone: 'America/Argentina/Buenos_Aires',
  navigation: [
    { moduleKey: null, label: 'Resumen', href: '/dashboard', contextColor: 'NEUTRAL' },
    { moduleKey: 'ALOJAMIENTO', label: 'Reservas', href: '/dashboard/reservas', contextColor: 'BRASS' },
    { moduleKey: 'ALOJAMIENTO', label: 'Habitaciones', href: '/dashboard/recursos', contextColor: 'BRASS' },
    { moduleKey: 'HOUSEKEEPING', label: 'Housekeeping', href: '/dashboard/housekeeping', contextColor: 'SAGE' },
    { moduleKey: 'POS_RESTAURANTE', label: 'Órdenes', href: '/dashboard/ordenes', contextColor: 'CLAY' },
    { moduleKey: 'FACTURACION', label: 'Facturación', href: '/dashboard/empresa', contextColor: 'CLAY' },
    { moduleKey: 'REPORTES', label: 'Reportes', href: '/dashboard/reportes', contextColor: 'NEUTRAL' },
  ],
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
  navigation: [
    { moduleKey: null, label: 'Resumen', href: '/dashboard', contextColor: 'NEUTRAL' },
    { moduleKey: 'ALOJAMIENTO', label: 'Reservas', href: '/dashboard/reservas', contextColor: 'NEUTRAL' },
    { moduleKey: 'ALOJAMIENTO', label: 'Recursos', href: '/dashboard/recursos', contextColor: 'NEUTRAL' },
    { moduleKey: 'REPORTES', label: 'Reportes', href: '/dashboard/reportes', contextColor: 'NEUTRAL' },
  ],
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
    'booking.singular': 'Turno',
    'customer.singular': 'Cliente',
  },
  navigation: [
    { moduleKey: null, label: 'Resumen', href: '/dashboard', contextColor: 'NEUTRAL' },
    { moduleKey: 'POS_RESTAURANTE', label: 'Órdenes', href: '/dashboard/ordenes', contextColor: 'CLAY' },
    { moduleKey: 'POS_RESTAURANTE', label: 'Productos', href: '/dashboard/productos', contextColor: 'CLAY' },
    { moduleKey: 'ALOJAMIENTO', label: 'Turnos', href: '/dashboard/turnos', contextColor: 'BRASS' },
    { moduleKey: 'FACTURACION', label: 'Facturación', href: '/dashboard/empresa', contextColor: 'CLAY' },
    { moduleKey: 'REPORTES', label: 'Reportes', href: '/dashboard/reportes', contextColor: 'NEUTRAL' },
  ],
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
// Fuente real — todavía NO existe.
//
// `GET /api/business/context` llega con la Fase 4 del plan de separación de
// dominios. Hasta entonces esta función no se implementa a medias con
// `/api/business/modules` + valores inventados: eso sería exactamente la
// navegación hardcodeada que V3 tiene prohibido crear.
// ─────────────────────────────────────────────────────────────────────────

export function endpointSource(): BusinessContextSource {
  return () => Promise.reject(
    new Error('GET /api/business/context todavía no existe — llega con la Fase 4'),
  )
}
