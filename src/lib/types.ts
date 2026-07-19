// Tipos alineados con los contratos reales de la API (app repo)

export interface Category {
  id: string
  name: string
  description?: string
  fields: CategoryField[]
  active: boolean
}

export interface CategoryField {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'date'
  required: boolean
  options?: string[]
}

export interface Resource {
  id: string
  name: string
  categoryId: string
  basePrice: number
  visualData?: VisualData | null
}

export interface VisualData {
  shape: string
  width: number
  height: number
  positionX: number
  positionY: number
  rotationDegrees: number
}

export interface Customer {
  id: string
  fullName: string
  email: string
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface Reservation {
  id: string
  resourceId: string
  customer: Customer
  startTime: string
  endTime: string
  status: ReservationStatus
  details: Record<string, unknown>
}

export interface ApiError {
  code: string
  message: string
  errors?: {
    formErrors?: string[]
    fieldErrors?: Record<string, string[]>
  }
}
