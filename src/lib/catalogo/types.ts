export interface CategoryField {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'date'
  required: boolean
  options?: string[]
}

export interface Category {
  id: string
  name: string
  description?: string
  fields: CategoryField[]
  active: boolean
  /** Backlog E1 — true = categoría de alojamiento (Reservas + Estadías), false = servicios (Turnos). */
  isLodging: boolean
  /**
   * D8-taxonomía (28/08/2026, diseno-taxonomia-tipos-reserva-2026-08-28.md)
   * — true = una reserva a la vez (checkAvailability binaria). false =
   * cupo compartido (varias reservas hasta `capacity`). Obligatorio desde
   * este cambio: antes no tenía NINGÚN control en la UI y quedaba en
   * `false` sin que nadie lo hubiera elegido (caso real: Peluquería/Spa).
   */
  isExclusive: boolean
}

export interface WasteReason {
  id: string
  businessId: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface RecordWasteInput {
  productId?: string | null
  productVariantId?: string | null
  quantity: number
  wasteReasonId: string
  notes?: string
}

/**
 * 27/08/2026, pendientes-2026-08-27.md — gemelo de WasteReason. Adoptado de
 * `proyecto script` (DESTINOS_CONSUMO): un consumo interno (comida de
 * personal, degustación, elaboración interna) es costo operativo, no
 * pérdida — catálogo propio, nunca se mezcla con motivos de merma.
 */
export interface ConsumptionDestination {
  id: string
  businessId: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface RecordConsumptionInput {
  productId?: string | null
  productVariantId?: string | null
  quantity: number
  consumptionDestinationId: string
  notes?: string
}
