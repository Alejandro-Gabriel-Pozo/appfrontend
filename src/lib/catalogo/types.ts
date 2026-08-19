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
