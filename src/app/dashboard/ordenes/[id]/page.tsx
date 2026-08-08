'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ordersApi, customersApi, productsApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Order, OrderItem, Customer, Product, OrderStatus } from '@/lib/types'

const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT:     'Borrador',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
}

const STATUS_COLOR: Record<OrderStatus, { bg: string; text: string; dot: string }> = {
  DRAFT:     { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', dot: '#64748b' },
  CONFIRMED: { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', dot: '#10b981' },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', dot: '#ef4444' },
  COMPLETED: { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', dot: '#3b82f6' },
}

const ITEM_TYPE_LABEL: Record<string, string> = {
  PRODUCT:         'Producto',
  PRODUCT_VARIANT: 'Variante',
  RESERVATION:     'Reserva',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ h = 20, w = '100%', radius = 8 }: { h?: number; w?: number | string; radius?: number }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: radius,
        background: 'rgba(255,255,255,0.06)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  )
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params?.id as string

  const [order, setOrder]       = useState<Order | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Acciones
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: 'confirm' | 'cancel' | 'complete' | null }>({
    open: false, action: null,
  })

  // Notas
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue]     = useState('')
  const [savingNotes, setSavingNotes]   = useState(false)

  // Nuevo ítem
  const [newItem, setNewItem] = useState({ productId: '', quantity: 1, unitPrice: 0 })
  const [addingItem, setAddingItem] = useState(false)
  const [removingItem, setRemovingItem] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const [ord, prods] = await Promise.all([
        ordersApi.get(id),
        productsApi.list(),
      ])
      setOrder(ord)
      setNotesValue(ord.notes ?? '')
      setProducts(prods)

      // Cargar cliente
      const custs = await customersApi.list() as Customer[]
      const arr = Array.isArray(custs) ? custs : (custs as { data: Customer[] }).data
      const c = arr.find(c => c.id === ord.customerId) ?? null
      setCustomer(c)
    } catch (err: unknown) {
      const e = err as { status?: number }
      if (e?.status === 404) {
        setNotFound(true)
      } else {
        toast(extractErrorMessage(err), 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { load() }, [load])

  // ─── Transiciones de estado ──────────────────────────────────────────────
  async function doAction(action: 'confirm' | 'cancel' | 'complete') {
    setActionLoading(action)
    try {
      const updated = await ordersApi[action](id)
      setOrder(updated)
      toast({ confirm: 'Orden confirmada', cancel: 'Orden cancelada', complete: 'Orden completada' }[action], 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
      setConfirmDialog({ open: false, action: null })
    }
  }

  // ─── Notas ───────────────────────────────────────────────────────────────
  async function saveNotes() {
    setSavingNotes(true)
    try {
      const updated = await ordersApi.updateNotes(id, notesValue || null)
      setOrder(updated)
      setEditingNotes(false)
      toast('Notas guardadas', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSavingNotes(false)
    }
  }

  // ─── Agregar ítem ────────────────────────────────────────────────────────
  async function handleAddItem() {
    if (!newItem.productId || newItem.quantity < 1) return
    setAddingItem(true)
    try {
      const updated = await ordersApi.addItem(id, {
        itemType:  'PRODUCT',
        productId: newItem.productId,
        quantity:  newItem.quantity,
        unitPrice: newItem.unitPrice,
      })
      // El backend devuelve el OrderItem; recargamos la orden completa
      await load()
      setNewItem({ productId: '', quantity: 1, unitPrice: 0 })
      toast('Ítem agregado', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setAddingItem(false)
    }
  }

  // ─── Eliminar ítem ───────────────────────────────────────────────────────
  async function handleRemoveItem(itemId: string) {
    setRemovingItem(itemId)
    try {
      await ordersApi.removeItem(id, itemId)
      await load()
      toast('Ítem eliminado', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setRemovingItem(null)
    }
  }

  // ─── Producto seleccionado ───────────────────────────────────────────────
  function getProductName(item: OrderItem) {
    const p = products.find(p => p.id === item.productId)
    return p?.name ?? item.productId?.slice(0, 8) + '…'
  }

  // ─── LOADING ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Skeleton h={16} w={90} />
          <Skeleton h={28} w={220} />
          <Skeleton h={28} w={100} radius={20} />
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <Skeleton h={120} />
          <Skeleton h={200} />
          <Skeleton h={80} />
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
      </div>
    )
  }

  if (notFound || !order) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
        <svg style={{ width: 48, height: 48, color: '#374151', margin: '0 auto 16px' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h2 style={{ color: '#e2e4ea', fontWeight: 600, marginBottom: 8 }}>Orden no encontrada</h2>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>El ID ingresado no corresponde a ninguna orden.</p>
        <Link href="/dashboard/ordenes" style={{ color: '#10b981', fontSize: 14 }}>← Volver a Órdenes</Link>
      </div>
    )
  }

  const sc = STATUS_COLOR[order.status]
  const isDraft = order.status === 'DRAFT'

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .detail-card {
          background: #13151e;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          margin-bottom: 16px;
        }
        .detail-card-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          font-size: 13px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .detail-card-body { padding: 20px; }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px;
        }
        .meta-item label {
          display: block;
          font-size: 11px;
          color: #4b5563;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 4px;
        }
        .meta-item p {
          font-size: 14px;
          color: #e2e4ea;
          font-weight: 500;
        }
        .item-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .item-row:last-child { border-bottom: none; }
        .btn-action {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: opacity 150ms;
        }
        .btn-action:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-confirm  { background: rgba(16,185,129,0.12); color: #10b981; }
        .btn-confirm:not(:disabled):hover  { background: rgba(16,185,129,0.22); }
        .btn-complete { background: rgba(59,130,246,0.12);  color: #60a5fa; }
        .btn-complete:not(:disabled):hover { background: rgba(59,130,246,0.22); }
        .btn-cancel   { background: rgba(239,68,68,0.1);   color: #f87171; }
        .btn-cancel:not(:disabled):hover   { background: rgba(239,68,68,0.2); }
        .btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 8px; font-size: 13px;
          background: rgba(255,255,255,0.05); color: #9ca3af;
          border: none; cursor: pointer; transition: background 150ms;
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.09); }
        .input-sm {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 13px;
          color: #e2e4ea;
          outline: none;
        }
        .input-sm:focus { border-color: #10b981; }
      `}</style>

      {/* ── Encabezado ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/dashboard/ordenes"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6b7280', textDecoration: 'none' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Órdenes
          </Link>
          <span style={{ color: '#374151' }}>/</span>
          <span style={{ fontSize: 13, color: '#9ca3af', fontFamily: 'monospace' }}>{order.id.slice(0, 12)}…</span>
        </div>

        {/* Estado badge */}
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20,
            fontSize: 12, fontWeight: 600,
            background: sc.bg, color: sc.text,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      {/* ── Acciones de transición ── */}
      {(isDraft || order.status === 'CONFIRMED') && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {isDraft && (
            <button
              className="btn-action btn-confirm"
              disabled={actionLoading !== null}
              onClick={() => setConfirmDialog({ open: true, action: 'confirm' })}
            >
              {actionLoading === 'confirm' ? '…' : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmar orden
                </>
              )}
            </button>
          )}
          {order.status === 'CONFIRMED' && (
            <button
              className="btn-action btn-complete"
              disabled={actionLoading !== null}
              onClick={() => setConfirmDialog({ open: true, action: 'complete' })}
            >
              {actionLoading === 'complete' ? '…' : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Marcar completada
                </>
              )}
            </button>
          )}
          <button
            className="btn-action btn-cancel"
            disabled={actionLoading !== null}
            onClick={() => setConfirmDialog({ open: true, action: 'cancel' })}
          >
            {actionLoading === 'cancel' ? '…' : (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancelar orden
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Metadatos ── */}
      <div className="detail-card">
        <div className="detail-card-header">Información</div>
        <div className="detail-card-body">
          <div className="meta-grid">
            <div className="meta-item">
              <label>Cliente</label>
              <p>{customer?.fullName ?? '—'}</p>
              {customer?.email && (
                <span style={{ fontSize: 12, color: '#6b7280' }}>{customer.email}</span>
              )}
            </div>
            <div className="meta-item">
              <label>Total</label>
              <p style={{ color: '#10b981', fontWeight: 700, fontSize: 18 }}>
                {fmtMoney(order.totalAmount)}
              </p>
            </div>
            <div className="meta-item">
              <label>Creada</label>
              <p>{fmtDate(order.createdAt)}</p>
            </div>
            {order.confirmedAt && (
              <div className="meta-item">
                <label>Confirmada</label>
                <p>{fmtDate(order.confirmedAt)}</p>
              </div>
            )}
            {order.completedAt && (
              <div className="meta-item">
                <label>Completada</label>
                <p>{fmtDate(order.completedAt)}</p>
              </div>
            )}
            {order.cancelledAt && (
              <div className="meta-item">
                <label>Cancelada</label>
                <p style={{ color: '#f87171' }}>{fmtDate(order.cancelledAt)}</p>
              </div>
            )}
            <div className="meta-item">
              <label>ID completo</label>
              <p style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', wordBreak: 'break-all' }}>
                {order.id}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Ítems ── */}
      <div className="detail-card">
        <div className="detail-card-header">Ítems ({order.items.length})</div>
        <div className="detail-card-body" style={{ padding: isDraft ? '16px 20px 8px' : '20px' }}>
          {order.items.length === 0 ? (
            <p style={{ color: '#4b5563', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Sin ítems</p>
          ) : (
            <>
              {/* Cabecera columnas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 90px 40px', gap: 8, padding: '0 0 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Producto', 'Tipo', 'Cant.', 'Subtotal', ''].map((h, i) => (
                  <span key={i} style={{ fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                ))}
              </div>

              {order.items.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 90px 90px 40px',
                    gap: 8,
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    opacity: removingItem === item.id ? 0.4 : 1,
                    transition: 'opacity 200ms',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 14, color: '#e2e4ea', fontWeight: 500 }}>
                      {getProductName(item)}
                    </p>
                    <p style={{ fontSize: 11, color: '#4b5563' }}>{fmtMoney(item.unitPrice)} c/u</p>
                  </div>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(255,255,255,0.06)', color: '#9ca3af',
                  }}>
                    {ITEM_TYPE_LABEL[item.itemType] ?? item.itemType}
                  </span>
                  <span style={{ fontSize: 14, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                    × {item.quantity}
                  </span>
                  <span style={{ fontSize: 14, color: '#e2e4ea', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtMoney(item.subtotal)}
                  </span>
                  {isDraft ? (
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={removingItem !== null}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: 'rgba(239,68,68,0.1)', color: '#f87171',
                        border: 'none', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, transition: 'background 150ms',
                      }}
                      aria-label="Quitar ítem"
                    >
                      ×
                    </button>
                  ) : <span />}
                </div>
              ))}

              {/* Total */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                paddingTop: 12, marginTop: 4,
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}>
                <span style={{ fontSize: 11, color: '#4b5563', marginRight: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(order.totalAmount)}
                </span>
              </div>
            </>
          )}

          {/* Agregar ítem — solo DRAFT */}
          {isDraft && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Agregar ítem
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <select
                  className="input-sm"
                  style={{ flex: 1, minWidth: 160 }}
                  value={newItem.productId}
                  onChange={e => {
                    const prod = products.find(p => p.id === e.target.value)
                    setNewItem(n => ({ ...n, productId: e.target.value, unitPrice: prod?.basePrice ?? 0 }))
                  }}
                >
                  <option value="">Seleccioná un producto…</option>
                  {products.filter(p => p.active).map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {fmtMoney(p.basePrice)}</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="input-sm"
                  style={{ width: 70 }}
                  min={1}
                  placeholder="Cant."
                  value={newItem.quantity}
                  onChange={e => setNewItem(n => ({ ...n, quantity: Number(e.target.value) }))}
                />
                <input
                  type="number"
                  className="input-sm"
                  style={{ width: 100 }}
                  min={0}
                  step={0.01}
                  placeholder="Precio"
                  value={newItem.unitPrice || ''}
                  onChange={e => setNewItem(n => ({ ...n, unitPrice: Number(e.target.value) }))}
                />
                <button
                  className="btn-action btn-confirm"
                  style={{ padding: '7px 16px' }}
                  onClick={handleAddItem}
                  disabled={!newItem.productId || newItem.quantity < 1 || addingItem}
                >
                  {addingItem ? '…' : '+ Agregar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Notas ── */}
      <div className="detail-card">
        <div className="detail-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Notas</span>
          {isDraft && !editingNotes && (
            <button
              className="btn-ghost"
              style={{ padding: '3px 10px', fontSize: 12 }}
              onClick={() => setEditingNotes(true)}
            >
              Editar
            </button>
          )}
        </div>
        <div className="detail-card-body">
          {editingNotes ? (
            <>
              <textarea
                className="input-sm"
                style={{ width: '100%', resize: 'vertical', minHeight: 80 }}
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                placeholder="Notas internas sobre la orden…"
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  className="btn-ghost"
                  onClick={() => { setEditingNotes(false); setNotesValue(order.notes ?? '') }}
                >
                  Cancelar
                </button>
                <button
                  className="btn-action btn-confirm"
                  onClick={saveNotes}
                  disabled={savingNotes}
                >
                  {savingNotes ? '…' : 'Guardar notas'}
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 14, color: order.notes ? '#c9cdd4' : '#4b5563', fontStyle: order.notes ? 'normal' : 'italic' }}>
              {order.notes || 'Sin notas.'}
            </p>
          )}
        </div>
      </div>

      {/* ── ConfirmDialog ── */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={
          confirmDialog.action === 'confirm'  ? 'Confirmar orden' :
          confirmDialog.action === 'complete' ? 'Completar orden' :
          'Cancelar orden'
        }
        description={
          confirmDialog.action === 'confirm'  ? '¿Confirmás esta orden? El cliente recibirá la confirmación.' :
          confirmDialog.action === 'complete' ? '¿Marcás la orden como completada? Esta acción no se puede deshacer.' :
          '¿Cancelás esta orden? Esta acción no se puede deshacer.'
        }
        confirmLabel={
          confirmDialog.action === 'confirm'  ? 'Sí, confirmar' :
          confirmDialog.action === 'complete' ? 'Sí, completar' :
          'Sí, cancelar'
        }
        variant={confirmDialog.action === 'cancel' ? 'danger' : 'default'}
        onConfirm={() => confirmDialog.action && doAction(confirmDialog.action)}
        onClose={() => setConfirmDialog({ open: false, action: null })}
      />
    </div>
  )
}
