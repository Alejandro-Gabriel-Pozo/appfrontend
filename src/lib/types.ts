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

// ─── Horario de atención (negocio + override por recurso) ─────────────────────
// Cascada: si un recurso tiene ventanas propias, reemplazan (no se combinan)
// al horario por defecto del negocio para ese recurso. Ver
// docs/conocimiento-del-negocio.md en app-main.

export interface OperatingWindow {
  id: string
  dayOfWeek: number // 0 = lunes ... 6 = domingo
  startTime: string // HH:MM:SS
  endTime: string
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface CustomerTag {
  id: string
  name: string
}

export interface CustomerRate {
  id: string
  businessId: string
  customerId: string
  resourceId: string | null
  serviceId: string | null
  price: number
  active: boolean
  notes?: string | null
}

// ─── Cuentas corrientes ─────────────────────────────────────────────────────

export type TransactionType = 'CHARGE' | 'PAYMENT' | 'REFUND' | 'ADJUSTMENT'
export type TransactionStatus = 'PENDING' | 'SETTLED' | 'FAILED' | 'VOIDED'

export interface FinancialTransaction {
  id: string
  businessId: string
  customerId: string
  reservationId: string | null
  type: TransactionType
  amount: number
  currency: string
  status: TransactionStatus
  notes?: string | null
  createdAt: string
}

export interface CustomerStatement {
  customerId: string
  balance: number
  transactions: FinancialTransaction[]
}

export interface Customer {
  id: string
  businessId: string
  fullName: string
  email: string
  kind?: 'INDIVIDUAL' | 'COMPANY'
  active?: boolean
  tags?: CustomerTag[]
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

// ─── Team members (empleados) ───────────────────────────────────────────────────
// `id` acá es el id de la MEMBERSHIP (persona + este negocio + rol), no de la
// identity — una misma persona puede tener membership en más de un negocio,
// cada una con su propio id. Ver backend: src/api/routes/users.routes.ts.

export type EmployeeRole = 'OWNER' | 'ADMIN' | 'RECEPTIONIST' | 'WAITER' | 'HOUSEKEEPING'
/** Roles asignables desde la API — OWNER se asigna solo al registrar el negocio. */
export type AssignableEmployeeRole = Exclude<EmployeeRole, 'OWNER'>

export interface TeamMember {
  id: string
  identityId: string
  businessId: string
  businessName: string
  role: EmployeeRole
  active: boolean
  createdAt: string
  email: string
}

export interface CreateTeamMemberInput {
  email: string
  password: string
  role: AssignableEmployeeRole
}

export interface UpdateTeamMemberInput {
  role?: AssignableEmployeeRole
  password?: string
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
  serviceId?: string | null
  partySize?: number
  notes?: string | null
  totalPrice: number
  // El backend no trackea estas fechas a nivel de dominio para reservas
  // todavía (a diferencia de otras entidades) — quedan opcionales a
  // propósito, no asumir que siempre vienen.
  createdAt?: string
  updatedAt?: string
}

// ─── Housekeeping ────────────────────────────────────────────────────────────
export type HousekeepingStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'INSPECTED' | 'OUT_OF_SERVICE'
export type Shift = 'MORNING' | 'AFTERNOON' | 'NIGHT'

export interface HousekeepingTask {
  id: string
  businessId: string
  resourceId: string
  assignedTo: string | null
  status: HousekeepingStatus
  notes: string | null
  shift: Shift
  scheduledFor: string
  startedAt: string | null
  completedAt: string | null
  inspectedAt: string | null
  inspectedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateHousekeepingTaskInput {
  resourceId: string
  shift: Shift
  scheduledFor: string
  notes?: string
}

// ─── Stays (check-in / check-out) ──────────────────────────────────────────────
export type StayStatus = 'CHECKED_IN' | 'CHECKED_OUT' | 'NO_SHOW'

export interface Stay {
  id: string
  businessId: string
  reservationId: string
  resourceId: string
  customerId: string
  assignedBy: string
  status: StayStatus
  checkedInAt: string
  checkedOutAt: string | null
  noShowAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CheckInInput {
  reservationId: string
  resourceId: string
  notes?: string
}

export interface CheckOutInput {
  notes?: string
  nextCleaningShift?: Shift
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

// ─── Portal de clientes ─────────────────────────────────────────────────────
// Sesión de un cliente final autenticado en /portal/[businessSlug]. A
// diferencia del JWT de staff, la respuesta de register/login del backend
// (app-main/src/api/routes/customer.routes.ts) ya trae el objeto `customer`
// completo — no hace falta decodificar el JWT en el front. `businessSlug` se
// guarda junto al token porque customerApiFetch es una función fuera de
// React (no hook) y necesita saber a qué /portal/{slug}/login redirigir en
// un 401, sin depender de useParams().

export interface CustomerSession {
  token: string
  customer: { id: string; fullName: string; email: string }
  businessSlug: string
}

export interface AvailabilityResource {
  id: string
  name: string
  categoryId: string
  basePrice: number
}

export interface AvailabilitySearchResult {
  categoryId: string | null
  startTime: string
  endTime: string
  available: AvailabilityResource[]
  total: number
}
