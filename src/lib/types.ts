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

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  businessId: string
  fullName: string
  email: string
  createdAt: string
  updatedAt: string
}

// ─── Resource / Reservation ───────────────────────────────────────────────────

export interface Resource {
  id: string
  name: string
  description?: string | null
  categoryId: string
  basePrice: number
  active: boolean
}

export interface CreateResourceInput {
  name: string
  description?: string | null
  categoryId: string
  basePrice: number
}

export interface UpdateResourceInput {
  name?: string
  description?: string | null
  categoryId?: string
  basePrice?: number
  active?: boolean
}

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

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface Reservation {
  id: string
  resourceId: string
  customer: { id: string; fullName?: string; email?: string }
  startTime: string
  endTime: string
  status: ReservationStatus
  details?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  businessId: string
  categoryId: string | null
  name: string
  description: string | null
  basePrice: number
  sku: string | null
  hasVariants: boolean
  stockQuantity: number
  stockMinAlert: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductVariant {
  id: string
  productId: string
  name: string
  attributes: Record<string, string>
  sku: string | null
  priceOverride: number | null
  stockQuantity: number
  stockMinAlert: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProductInput {
  categoryId?: string | null
  name: string
  description?: string | null
  basePrice: number
  sku?: string | null
  hasVariants?: boolean
  stockQuantity?: number
  stockMinAlert?: number
}

export interface UpdateProductInput {
  categoryId?: string | null
  name?: string
  description?: string | null
  basePrice?: number
  sku?: string | null
  hasVariants?: boolean
  stockQuantity?: number
  stockMinAlert?: number
  active?: boolean
}

export interface CreateVariantInput {
  name: string
  attributes?: Record<string, string>
  sku?: string | null
  priceOverride?: number | null
  stockQuantity?: number
  stockMinAlert?: number
}

export interface UpdateVariantInput {
  name?: string
  attributes?: Record<string, string>
  sku?: string | null
  priceOverride?: number | null
  stockQuantity?: number
  stockMinAlert?: number
  active?: boolean
}

// ─── Orders ──────────────────────────────────────────────────────────────────
// Sincronizado con domain/order.entities.ts del backend

export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export type OrderItemType = 'PRODUCT' | 'PRODUCT_VARIANT' | 'RESERVATION'

export interface OrderItem {
  id: string
  orderId: string
  itemType: OrderItemType
  /** FK a products.id — presente para PRODUCT y PRODUCT_VARIANT */
  productId: string | null
  /** FK a product_variants.id — presente para PRODUCT_VARIANT */
  productVariantId: string | null
  /** FK a reservations.id — presente para RESERVATION */
  reservationId: string | null
  quantity: number
  unitPrice: number
  /** quantity * unitPrice (snapshot inmutable) */
  subtotal: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  businessId: string
  customerId: string
  status: OrderStatus
  totalAmount: number
  notes: string | null
  items: OrderItem[]
  confirmedAt: string | null
  cancelledAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateOrderItemInput {
  itemType: OrderItemType
  productId?: string | null
  productVariantId?: string | null
  reservationId?: string | null
  quantity: number
  unitPrice: number
}

export interface CreateOrderInput {
  customerId: string
  notes?: string | null
  items: CreateOrderItemInput[]
}

export interface ListOrdersFilters {
  customerId?: string
  status?: OrderStatus
  from?: string
  to?: string
  limit?: number
  offset?: number
}
