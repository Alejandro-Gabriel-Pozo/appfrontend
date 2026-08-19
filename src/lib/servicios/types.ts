// ─── Bookable Services / Resource Locks ────────────────────────────────────────
// "Servicio" (bookable_service) es la unidad reservable con duración fija.
// resource_locks vincula un servicio con recursos físicos ADICIONALES que
// bloquea mientras dura (ej. "Corte" bloquea la silla que elegís + la estilista).

export type BookingMode = 'slot' | 'block' | 'event'

export interface BookableService {
  id: string
  categoryId: string
  name: string
  description?: string
  bookingMode: BookingMode
  /** null = sin duración fija; el usuario/recepcionista elige start y end */
  durationMinutes: number | null
  price: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateBookableServiceInput {
  categoryId: string
  name: string
  description?: string
  bookingMode: BookingMode
  durationMinutes?: number | null
  price: number
}

export interface UpdateBookableServiceInput {
  categoryId?: string
  name?: string
  description?: string
  bookingMode?: BookingMode
  durationMinutes?: number | null
  price?: number
  active?: boolean
}

export interface ResourceLock {
  serviceId: string
  resourceId: string
  sortOrder: number
}

/**
 * Tarifa de un servicio (18/08/2026, spec de mejoras PMS) — un mismo
 * BookableService puede tener varias RatePlan simultáneas (Rack,
 * Corporativa, No reembolsable). `validFrom`/`validTo` en formato
 * YYYY-MM-DD (fecha de calendario, no instante) — `null` = sin
 * restricción de ese extremo.
 */
export interface RatePlan {
  id: string
  serviceId: string
  name: string
  price: number
  includesBreakfast: boolean
  cancellationPolicy: string | null
  validFrom: string | null
  validTo: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateRatePlanInput {
  name: string
  price: number
  includesBreakfast?: boolean
  cancellationPolicy?: string | null
  validFrom?: string | null
  validTo?: string | null
}

export interface UpdateRatePlanInput {
  name?: string
  price?: number
  includesBreakfast?: boolean
  cancellationPolicy?: string | null
  validFrom?: string | null
  validTo?: string | null
  active?: boolean
}
