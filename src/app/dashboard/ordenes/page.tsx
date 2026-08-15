'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ordersApi, customersApi, productsApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import type { Order, OrderStatus, Customer, Product, CreateOrderItemInput } from '@/lib/types'

const PAGE_SIZE = 20

const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT:     'Borrador',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
}

const STATUS_CLASS: Record<OrderStatus, string> = {
  DRAFT:     'bg-slate-500/10 text-slate-400',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
  COMPLETED: 'bg-blue-500/10 text-blue-400',
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
  const [orders, setOrders]     = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts]   = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filtros y paginación
  const [search, setSearch]           = useState('')
  const [filterStatus, setFilterStatus] = useState<OrderStatus | ''>('')
  const [page, setPage]               = useState(1)

  // Modal nueva orden
  const [modalOpen, setModalOpen]   = useState(false)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [newItem, setNewItem]       = useState({ productId: '', quantity: 1, unitPrice: 0 })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ords, custs, prods] = await Promise.all([
        ordersApi.list(),
        customersApi.list() as Promise<Customer[]>,
        productsApi.list(),
      ])
      setOrders(ords)
      setCustomers(Array.isArray(custs) ? custs : (custs as { data: Customer[] }).data)
      setProducts(prods)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { queueMicrotask(load) }, [load])

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
  async function doAction(id: string, action: 'confirm' | 'cancel' | 'complete') {
    setActionLoading(`${id}-${action}`)
    try {
      await ordersApi[action](id)
      const labels = { confirm: 'Orden confirmada', cancel: 'Orden cancelada', complete: 'Orden completada' }
      toast(labels[action], 'success')
      load()
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
        unitPrice:   newItem.unitPrice || prod.basePrice,
      },
    ])
    setNewItem({ productId: '', quantity: 1, unitPrice: 0 })
  }

  function removeDraftItem(i: number) {
    setDraftItems(prev => prev.filter((_, idx) => idx !== i))
  }

  const draftTotal = draftItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

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
      const items: CreateOrderItemInput[] = draftItems.map(i => ({
        itemType:  'PRODUCT',
        productId: i.productId,
        quantity:  i.quantity,
        unitPrice: i.unitPrice,
      }))
      await ordersApi.create({
        customerId: customer.id,
        notes: form.notes || null,
        items,
      })
      toast('Orden creada en borrador', 'success')
      setModalOpen(false)
      setForm(EMPTY_FORM)
      setDraftItems([])
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function openModal() {
    setForm(EMPTY_FORM)
    setDraftItems([])
    setNewItem({ productId: '', quantity: 1, unitPrice: 0 })
    setModalOpen(true)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Órdenes</h1>
          <p className="text-sm text-slate-400 mt-0.5">Carrito unificado de reservas y productos</p>
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
            <div key={i} className="h-16 rounded-lg bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-slate-400 font-medium">
            {search || filterStatus ? 'Sin resultados para ese filtro' : 'Sin órdenes'}
          </p>
          {!search && !filterStatus && (
            <p className="text-slate-600 text-sm mt-1">Creá la primera con el botón de arriba</p>
          )}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Ítems</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Creada</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginated.map(o => (
                  <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-slate-500">{o.id.slice(0, 8)}…</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-white">{getCustomerName(o.customerId)}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 tabular-nums">
                      {o.items.length} ítem{o.items.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300 font-medium tabular-nums">
                      {fmtMoney(o.totalAmount)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 text-xs tabular-nums">
                      {fmtDate(o.createdAt)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {o.status === 'DRAFT' && (
                          <button
                            onClick={() => doAction(o.id, 'confirm')}
                            disabled={actionLoading !== null}
                            className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === `${o.id}-confirm` ? '…' : 'Confirmar'}
                          </button>
                        )}
                        {o.status === 'CONFIRMED' && (
                          <button
                            onClick={() => doAction(o.id, 'complete')}
                            disabled={actionLoading !== null}
                            className="text-xs px-2.5 py-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === `${o.id}-complete` ? '…' : 'Completar'}
                          </button>
                        )}
                        {(o.status === 'DRAFT' || o.status === 'CONFIRMED') && (
                          <button
                            onClick={() => doAction(o.id, 'cancel')}
                            disabled={actionLoading !== null}
                            className="text-xs px-2.5 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
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
              <span className="text-slate-500">
                {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} · página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-md bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-md bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
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
            <p className="mt-1 text-xs text-slate-500">El cliente debe estar registrado en el sistema.</p>
          </div>

          {/* Notas */}
          <div>
            <label className="label">Notas <span className="text-slate-600">(opcional)</span></label>
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
            <div className="flex gap-2 mb-2">
              <select
                className="input flex-1"
                value={newItem.productId}
                onChange={e => {
                  const prod = products.find(p => p.id === e.target.value)
                  setNewItem(n => ({ ...n, productId: e.target.value, unitPrice: prod?.basePrice ?? 0 }))
                }}
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
              <input
                type="number"
                className="input w-28"
                min={0}
                step={0.01}
                placeholder="Precio"
                value={newItem.unitPrice || ''}
                onChange={e => setNewItem(n => ({ ...n, unitPrice: Number(e.target.value) }))}
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
                  <li key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] text-sm">
                    <span className="text-slate-300">{item.productName}</span>
                    <span className="text-slate-500 tabular-nums text-xs">
                      {item.quantity} × {fmtMoney(item.unitPrice)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDraftItem(i)}
                      className="ml-3 text-red-400 hover:text-red-300 text-xs"
                      aria-label="Quitar ítem"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600 mt-1">Ningún ítem agregado aún.</p>
            )}

            {draftItems.length > 0 && (
              <p className="text-right text-sm font-medium text-white mt-2">
                Total: {fmtMoney(draftTotal)}
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
