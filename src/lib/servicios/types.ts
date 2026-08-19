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

/**
 * Horario semanal de un servicio "slot" (19/08/2026, E7a — gap de producto
 * con backend listo desde antes, sin pantalla hasta ahora). Define A QUÉ
 * HORA puede arrancar un turno cada día de la semana y cuántos en simultáneo
 * (`maxCapacity`) — la duración de cada turno la pone `service.durationMinutes`,
 * no el horario. Solo aplica a `bookingMode='slot'`; los servicios "block"/
 * "event" no usan schedules (horario libre / horario único respectivamente).
 */
export interface ServiceSchedule {
  id: string
  serviceId: string
  /** 0 = lunes ... 6 = domingo */
  dayOfWeek: number
  /** HH:MM:SS */
  startTime: string
  maxCapacity: number
  active: boolean
}

export interface CreateServiceScheduleInput {
  dayOfWeek: number
  startTime: string
  maxCapacity: number
}

export interface UpdateServiceScheduleInput {
  dayOfWeek?: number
  startTime?: string
  maxCapacity?: number
  active?: boolean
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
