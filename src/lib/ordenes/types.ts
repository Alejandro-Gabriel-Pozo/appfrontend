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
  stayId?: string | null
  items: OrderItem[]
  confirmedAt: string | null
  cancelledAt: string | null
  completedAt: string | null
  servedAt: string | null
  createdAt: string
  updatedAt: string
  /** Transiciones válidas desde `status` — usar esto en vez de hardcodear la máquina de estados (A3). */
  allowedTransitions?: OrderStatus[]
}

export interface CreateOrderItemInput {
  itemType: OrderItemType
  productId?: string | null
  productVariantId?: string | null
  reservationId?: string | null
  quantity: number
  /**
   * ORDER-11 (03/09/2026) — SOLO para `RESERVATION`.
   *
   * Para `PRODUCT` y `PRODUCT_VARIANT` el backend lo **rechaza con 400**
   * desde el 22/08/2026 (D9-Parte 2, `CreateOrderItemSchema`): el precio lo
   * resuelve el servidor con el precio base del producto más la tarifa
   * especial del cliente si corresponde. Mandarlo hacía que el alta de orden
   * y el alta de ítem fallaran siempre — el módulo de órdenes no era
   * recorrible desde el panel.
   */
  unitPrice?: number
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
