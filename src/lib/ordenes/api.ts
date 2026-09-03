'use client'
import { apiFetch } from '../http'
import type { Order, OrderItem, CreateOrderInput, ListOrdersFilters } from './types'

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (filters: ListOrdersFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.customerId)     params.set('customerId', filters.customerId)
    if (filters.status)         params.set('status',     filters.status)
    if (filters.from)           params.set('from',       filters.from)
    if (filters.to)             params.set('to',         filters.to)
    if (filters.limit  != null) params.set('limit',      String(filters.limit))
    if (filters.offset != null) params.set('offset',     String(filters.offset))
    const qs = params.toString()
    return apiFetch<Order[]>(`/api/orders${qs ? `?${qs}` : ''}`)
  },
  get:         (id: string)                    => apiFetch<Order>(`/api/orders/${id}`),
  create:      (body: CreateOrderInput)        => apiFetch<Order>('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  confirm:     (id: string)                    => apiFetch<Order>(`/api/orders/${id}/confirm`,  { method: 'POST' }),
  complete:    (id: string)                    => apiFetch<Order>(`/api/orders/${id}/complete`, { method: 'POST' }),
  cancel:      (id: string)                    => apiFetch<Order>(`/api/orders/${id}/cancel`,   { method: 'POST' }),
  serve:       (id: string)                    => apiFetch<Order>(`/api/orders/${id}/serve`,    { method: 'POST' }),
  updateNotes: (id: string, notes: string | null) =>
    apiFetch<Order>(`/api/orders/${id}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
  // ORDER-11: `unitPrice` sale de la firma para PRODUCT/PRODUCT_VARIANT — el
  // servidor lo resuelve y el backend rechaza el body si viene.
  addItem: (id: string, body: { itemType: string; productId?: string | null; productVariantId?: string | null; reservationId?: string | null; quantity: number }) =>
    apiFetch<OrderItem>(`/api/orders/${id}/items`, { method: 'POST', body: JSON.stringify(body) }),
  removeItem: (id: string, itemId: string) =>
    apiFetch<void>(`/api/orders/${id}/items/${itemId}`, { method: 'DELETE' }),
}
