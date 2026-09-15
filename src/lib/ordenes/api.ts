'use client'
import { apiFetch } from '../http'
import type { Order, OrderItem, CreateOrderInput, ListOrdersFilters, CancelOrderWithCreditNoteResult } from './types'

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
  /**
   * `CANCEL-WITH-NC-UI-001` (15/09/2026, F3-01/F3-02 de
   * app-main/docs/auditoria-integral-fase3-2026-09-15.md) -- escape
   * administrativo para cancelar una orden que ya tiene una factura
   * ISSUED viva (el `cancel()` normal la rechaza). Requiere el rol
   * EMISOR_NOTA_CREDITO (ver `useCanIssueCreditNote()`,
   * hooks/useAuthRole.ts) -- el backend igual lo valida en serio.
   */
  cancelWithCreditNote: (id: string, reason: string) =>
    apiFetch<CancelOrderWithCreditNoteResult>(`/api/orders/${id}/cancel-with-credit-note`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  serve:       (id: string)                    => apiFetch<Order>(`/api/orders/${id}/serve`,    { method: 'POST' }),
  updateNotes: (id: string, notes: string | null) =>
    apiFetch<Order>(`/api/orders/${id}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
  // ORDER-11: `unitPrice` sale de la firma para PRODUCT/PRODUCT_VARIANT — el
  // servidor lo resuelve y el backend rechaza el body si viene. Bloque C
  // (backend, 15/09/2026): `serviceItemId` se suma a la firma para itemType
  // SERVICE, mismo criterio (sin unitPrice, el servidor lo resuelve).
  addItem: (id: string, body: { itemType: string; productId?: string | null; productVariantId?: string | null; reservationId?: string | null; serviceItemId?: string | null; quantity: number }) =>
    apiFetch<OrderItem>(`/api/orders/${id}/items`, { method: 'POST', body: JSON.stringify(body) }),
  removeItem: (id: string, itemId: string) =>
    apiFetch<void>(`/api/orders/${id}/items/${itemId}`, { method: 'DELETE' }),
}
