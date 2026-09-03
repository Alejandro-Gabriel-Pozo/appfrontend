'use client'
import { useState, useEffect, useMemo } from 'react'
import { useTable, useCreate, useInvalidate } from '@refinedev/core'
import { ordersApi, customersApi, productsApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import type { Order, OrderStatus, Customer, Product, CreateOrderItemInput } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Primera pantalla POS migrada a Bastión (18/08/2026), ahora en ZULU.

const PAGE_SIZE = 20

const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT:     'Borrador',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
}

// Semáforo Bastión (sección 5 del doc, mismo criterio que Reservas/
// Housekeeping — es universal, no cambia con el acento de módulo):
// borrador=brass (pendiente de confirmar), confirmada=sage, completada=gris
// neutro (ya cerrada), cancelada=clay.
const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  DRAFT:     'badge-pending',
  CONFIRMED: 'badge-confirmed',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled',
}

const ALL_STATUSES: OrderStatus[] = ['DRAFT', 'CONFIRMED', 'CANCELLED', 'COMPLETED']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false })
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

// ─── Formulario nueva orden ────────────────────────────────────────────────
interface DraftItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

const EMPTY_FORM = { customerEmail: '', notes: '' }

export default function OrdenesPage() {
  const { toast } = useToast()
  // Sin paginación server-side todavía (ver lib/refine/dataProvider.ts) —
  // filtrado/paginado sigue siendo 100% client-side, igual que antes.
  const { result, tableQuery } = useTable<Order>({ resource: 'ordenes', pagination: { mode: 'off' } })
  const orders = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createOrder } = useCreate<Order>()
  // confirm/cancel/complete son acciones con nombre (ordersApi[action]) que
  // no pasan por el data provider — invalidate() fuerza el refetch después.
  const invalidate = useInvalidate()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts]   = useState<Product[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filtros y paginación
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('')
  const [page, setPage]               = useState(1)

  // Modal nueva orden
  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [newItem, setNewItem]       = useState({ productId: '', quantity: 1 })
  const [submitting, setSubmitting] = useState(false)

  // Clientes/productos no están migrados a esta pantalla — se siguen
  // trayendo directo, igual que antes.
  useEffect(() => {
    queueMicrotask(() => {
      Promise.all([customersApi.list() as Promise<Customer[]>, productsApi.list()])
        .then(([custs, prods]) => {
          setCustomers(Array.isArray(custs) ? custs : (custs as { data: Customer[] }).data)
          setProducts(prods)
        })
        .catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

  // Filtrado y paginación en cliente
  const filtered = useMemo(() => {
    let list = orders
    if (filterStatus) list = list.filter(o => o.status === filterStatus)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(o => {
        const c = customers.find(c => c.id === o.customerId)
        return (
          c?.fullName.toLowerCase().includes(q) ||
          c?.email.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
        )
      })
    }
    return list
  }, [orders, filterStatus, search, customers])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => { queueMicrotask(() => setPage(1)) }, [search, filterStatus])

  function getCustomerName(customerId: string) {
    const c = customers.find(c => c.id === customerId)
    return c ? c.fullName : customerId.slice(0, 8) + '…'
  }

  // ─── Acciones de transición ─────────────────────────────────────────────
  async function doAction(id: string, action: 'confirm' | 'cancel' | 'complete' | 'serve') {
    setActionLoading(`${id}-${action}`)
    try {
      await ordersApi[action](id)
      const labels = { confirm: 'Orden confirmada', cancel: 'Orden cancelada', complete: 'Orden completada', serve: 'Orden marcada como servida' }
      toast(labels[action], 'success')
      invalidate({ resource: 'ordenes', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Gestión de ítems del draft ─────────────────────────────────────────
  function addDraftItem() {
    const prod = products.find(p => p.id === newItem.productId)
    if (!prod) return
    setDraftItems(prev => [
      ...prev,
      {
        productId:   prod.id,
        productName: prod.name,
        quantity:    newItem.quantity,
        // ORDER-11: el precio base es solo REFERENCIA para el borrador. El
        // precio real lo resuelve el servidor al crear la orden (puede
        // aplicar una tarifa especial del cliente) y no se manda en el body.
        unitPrice:   prod.basePrice,
      },
    ])
    setNewItem({ productId: '', quantity: 1 })
  }

  function removeDraftItem(i: number) {
    setDraftItems(prev => prev.filter((_, idx) => idx !== i))
  }

  /**
   * ORDER-11: es un ESTIMADO, no el total. Se calcula con el precio base de
   * cada producto; el servidor puede aplicar una tarifa especial del cliente
   * al crear la orden, y el total real sale de la respuesta.
   */
  const draftTotalEstimado = draftItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  // ─── Crear orden ────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (draftItems.length === 0) {
      toast('Agregá al menos un ítem a la orden.', 'error')
      return
    }
    setSubmitting(true)
    try {
      const customer = await customersApi.findByEmail(form.customerEmail)
      if (!customer) {
        toast('Cliente no encontrado. Crealo primero en la sección Clientes.', 'error')
        return
      }
      // ORDER-11: sin `unitPrice`. El backend lo rechaza para PRODUCT desde
      // el 22/08 y por eso el alta fallaba siempre.
      const items: CreateOrderItemInput[] = draftItems.map(i => ({
        itemType:  'PRODUCT',
        productId: i.productId,
        quantity:  i.quantity,
      }))
      await createOrder({
        resource: 'ordenes',
        values: {
          customerId: customer.id,
          notes: form.notes || null,
          items,
        },
      })
      toast('Orden creada en borrador', 'success')
      setModalOpen(false)
      setForm(EMPTY_FORM)
      setDraftItems([])
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function openModal() {
    setForm(EMPTY_FORM)
    setDraftItems([])
    setNewItem({ productId: '', quantity: 1 })
    setModalOpen(true)
  }

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Órdenes</h1>
          <p className="page-subtitle">Carrito unificado de reservas y productos</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva orden
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          className="input flex-1 min-w-[200px] max-w-xs"
          placeholder="Buscar cliente o ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input w-44"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as OrderStatus | '')}
        >
          <option value="">Todos los estados</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3>{search || filterStatus ? 'Sin resultados para ese filtro' : 'Sin órdenes'}</h3>
          {!search && !filterStatus && <p>Creá la primera con el botón de arriba</p>}
        </div>
      ) : (
        <>
          <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Ítems</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Creada</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paginated.map(o => (
                  <tr key={o.id}>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{o.id.slice(0, 8)}…</td>
                    <td className="table-cell-primary">{getCustomerName(o.customerId)}</td>
                    <td className="mono">{o.items.length} ítem{o.items.length !== 1 ? 's' : ''}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{fmtMoney(o.totalAmount)}</td>
                    <td>
                      <span className={STATUS_BADGE_CLASS[o.status]}>{STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtDate(o.createdAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        {o.status === 'DRAFT' && (
                          <button
                            onClick={() => doAction(o.id, 'confirm')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-confirm"
                          >
                            {actionLoading === `${o.id}-confirm` ? '…' : 'Confirmar'}
                          </button>
                        )}
                        {o.status === 'CONFIRMED' && !o.servedAt && (
                          <button
                            onClick={() => doAction(o.id, 'serve')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-neutral"
                          >
                            {actionLoading === `${o.id}-serve` ? '…' : 'Servir'}
                          </button>
                        )}
                        {o.status === 'CONFIRMED' && o.servedAt && (
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>✓ Servida</span>
                        )}
                        {o.status === 'CONFIRMED' && (
                          <button
                            onClick={() => doAction(o.id, 'complete')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-neutral"
                          >
                            {actionLoading === `${o.id}-complete` ? '…' : 'Completar'}
                          </button>
                        )}
                        {(o.status === 'DRAFT' || o.status === 'CONFIRMED') && (
                          <button
                            onClick={() => doAction(o.id, 'cancel')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-danger"
                          >
                            {actionLoading === `${o.id}-cancel` ? '…' : 'Cancelar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span style={{ color: 'var(--text-tertiary)' }}>
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} · página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary"
                  style={{ padding: '6px 12px' }}
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary"
                  style={{ padding: '6px 12px' }}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal nueva orden */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva orden">
        <form onSubmit={handleCreate} className="p-6 space-y-5">

          {/* Cliente */}
          <div>
            <label className="label">Email del cliente</label>
            <input
              type="email"
              className="input"
              placeholder="cliente@email.com"
              value={form.customerEmail}
              onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
              required
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>El cliente debe estar registrado en el sistema.</p>
          </div>

          {/* Notas */}
          <div>
            <label className="label">Notas <span style={{ color: 'var(--text-tertiary)' }}>(opcional)</span></label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Observaciones internas…"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {/* Agregar ítem */}
          <div>
            <label className="label">Ítems de la orden</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
              El precio final lo calcula el servidor al crear la orden: precio
              del producto más la tarifa especial del cliente, si tiene una.
            </p>
            <div className="flex gap-2 mb-2">
              <select
                className="input flex-1"
                value={newItem.productId}
                onChange={e => setNewItem(n => ({ ...n, productId: e.target.value }))}
              >
                <option value="">Producto…</option>
                {products.filter(p => p.active).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="number"
                className="input w-20"
                min={1}
                placeholder="Cant."
                value={newItem.quantity}
                onChange={e => setNewItem(n => ({ ...n, quantity: Number(e.target.value) }))}
              />
              <button
                type="button"
                onClick={addDraftItem}
                disabled={!newItem.productId || newItem.quantity < 1}
                className="btn-primary px-3 disabled:opacity-40"
              >
                +
              </button>
            </div>

            {/* Lista de ítems del draft */}
            {draftItems.length > 0 ? (
              <ul className="space-y-1.5">
                {draftItems.map((item, i) => (
                  <li key={i} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--surface-4)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.productName}</span>
                    <span className="mono" style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                      {item.quantity} × {fmtMoney(item.unitPrice)} aprox.
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDraftItem(i)}
                      className="ml-3 text-xs"
                      style={{ color: 'var(--danger)' }}
                      aria-label="Quitar ítem"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Ningún ítem agregado aún.</p>
            )}

            {draftItems.length > 0 && (
              <p className="text-right text-sm mt-2" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                Total estimado: {fmtMoney(draftTotalEstimado)}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <span className="spinner" /> : null}
              Crear orden
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
