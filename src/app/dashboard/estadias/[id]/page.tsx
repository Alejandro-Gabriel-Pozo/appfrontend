'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useInvalidate } from '@refinedev/core'
import Link from 'next/link'
import { staysApi, resourcesApi, customersApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useIsManagement } from '@/hooks/useAuthRole'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Stay, Resource, Customer, Shift, StayFolio } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Migrado de modales a ruta dedicada (auditoría UX de modales, 25/08/2026,
// docs/auditoria-modales.md) — check-out, no-show y transferencia a cuenta
// por cobrar eran 3 modales encadenados desde la lista. Acá viven en una
// sola página, con el folio siempre visible (el motivo del hallazgo:
// check-out es una decisión que depende de ver el saldo primero).
// "Nuevo check-in" se queda en modal en dashboard/estadias/page.tsx — es
// alta, no detalle/edición (mismo criterio que las fases anteriores).

const SHIFT_LABEL: Record<Shift, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }
const fmtMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format
function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false })
}

function Skeleton({ h = 20, w = '100%', radius = 8 }: { h?: number; w?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: radius }} />
}

export default function EstadiaDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const { toast } = useToast()
  const isManagement = useIsManagement()
  const invalidate = useInvalidate()

  const [stay, setStay] = useState<Stay | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [folio, setFolio] = useState<StayFolio | null>(null)
  const [loadingFolio, setLoadingFolio] = useState(true)

  const [checkOutForm, setCheckOutForm] = useState<{ notes: string; nextCleaningShift: Shift | '' }>({ notes: '', nextCleaningShift: '' })
  const [checkingOut, setCheckingOut] = useState(false)

  const [transferOpen, setTransferOpen] = useState(false)
  const [transferCompanyId, setTransferCompanyId] = useState('')
  const [transferNotes, setTransferNotes] = useState('')
  const [transferring, setTransferring] = useState(false)

  const [confirmNoShow, setConfirmNoShow] = useState(false)
  const [noShowing, setNoShowing] = useState(false)

  const companies = customers.filter(c => c.kind === 'COMPANY')

  const loadFolio = useCallback(async () => {
    setLoadingFolio(true)
    try {
      setFolio(await staysApi.getFolio(id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoadingFolio(false)
    }
  }, [id, toast])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      // Sin GET /api/stays/:id — mismo criterio que el adapter 'estadias'
      // de lib/refine/dataProvider.ts (listActive() + find por id). Una
      // estadía ya cerrada (checkout/no-show) no aparece acá — mismo
      // alcance que tenía el listado, que tampoco las mostraba.
      const [all, recs, custs] = await Promise.all([
        staysApi.listActive(),
        resourcesApi.list(),
        customersApi.list(),
      ])
      const found = all.find(s => s.id === id)
      if (!found) {
        setNotFound(true)
        return
      }
      setStay(found)
      setResources(recs)
      setCustomers(Array.isArray(custs) ? custs : custs.data)
      setCheckOutForm({ notes: '', nextCleaningShift: '' })
      setTransferOpen(false)
      setTransferCompanyId('')
      setTransferNotes('')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { queueMicrotask(load) }, [load])
  useEffect(() => { queueMicrotask(loadFolio) }, [loadFolio])

  const getResourceName = (rid: string) => resources.find(r => r.id === rid)?.name ?? rid.slice(0, 8) + '…'
  const getCustomerName = (cid: string) => customers.find(c => c.id === cid)?.fullName ?? cid.slice(0, 8) + '…'

  async function handleCheckOut() {
    if (!stay) return
    setCheckingOut(true)
    try {
      await staysApi.checkOut(stay.id, {
        ...(checkOutForm.notes && { notes: checkOutForm.notes }),
        ...(checkOutForm.nextCleaningShift && { nextCleaningShift: checkOutForm.nextCleaningShift }),
      })
      toast('Check-out realizado — se planificó la limpieza', 'success')
      invalidate({ resource: 'estadias', invalidates: ['list'] })
      router.push('/dashboard/estadias')
    } catch (err) {
      // El backend puede rechazar con 409 STAY_BALANCE_OWED aunque el
      // folio mostrado diga $0 (ej. un cargo nuevo llegó justo antes) —
      // recargamos el folio para que el mensaje que ve el usuario sea
      // consistente con lo que el backend acaba de evaluar.
      toast(extractErrorMessage(err), 'error')
      loadFolio()
    } finally {
      setCheckingOut(false)
    }
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    if (!stay || !transferCompanyId) return
    setTransferring(true)
    try {
      await staysApi.transferToReceivable(stay.id, {
        companyCustomerId: transferCompanyId,
        ...(transferNotes && { notes: transferNotes }),
      })
      toast('Saldo transferido a cuenta por cobrar', 'success')
      setTransferOpen(false)
      loadFolio()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setTransferring(false)
    }
  }

  async function handleNoShow() {
    if (!stay) return
    setNoShowing(true)
    try {
      await staysApi.noShow(stay.id)
      toast('Marcado como no show', 'success')
      invalidate({ resource: 'estadias', invalidates: ['list'] })
      router.push('/dashboard/estadias')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setNoShowing(false)
    }
  }

  // ─── LOADING ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="zulu" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Skeleton h={16} w={80} />
          <Skeleton h={28} w={220} />
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <Skeleton h={140} />
          <Skeleton h={220} />
        </div>
      </div>
    )
  }

  // ─── NOT FOUND ───────────────────────────────────────────────────────────
  if (notFound || !stay) {
    return (
      <div className="zulu" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
        <svg style={{ width: 48, height: 48, color: 'var(--text-tertiary)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Estadía no encontrada</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
          El ID ingresado no corresponde a ninguna estadía activa (ya con check-out o no-show no aparecen acá).
        </p>
        <Link href="/dashboard/estadias" style={{ color: 'var(--zulu-link)', fontSize: 14 }}>← Volver a Estadías</Link>
      </div>
    )
  }

  return (
    <div className="zulu" style={{ maxWidth: 640, margin: '0 auto' }}>
      <style>{`
        .detail-card-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .detail-card-body { padding: 20px; }
      `}</style>

      {/* ── Encabezado ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link
            href="/dashboard/estadias"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Estadías
          </Link>
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{getCustomerName(stay.customerId)}</h1>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{getResourceName(stay.resourceId)}</p>
        </div>
        <span className="badge-confirmed">En estadía</span>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* ── Detalle ── */}
        <div className="card">
          <div className="detail-card-header">Detalle</div>
          <div className="detail-card-body">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Check-in</p>
                <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>{fmt(stay.checkedInAt)}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Habitación</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getResourceName(stay.resourceId)}</p>
              </div>
            </div>
            {stay.notes && (
              <div className="mt-4">
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Notas</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{stay.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Check-out ── */}
        <div className="card">
          <div className="detail-card-header">Check-out</div>
          <div className="detail-card-body space-y-4">
            {loadingFolio ? (
              <div className="h-16 rounded-lg skeleton" />
            ) : folio && (
              <div className="card p-4">
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Saldo de la estadía</p>
                <p className="text-xl font-semibold" style={{ color: folio.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {fmtMoney(folio.balance)}
                </p>
                {folio.balance > 0 ? (
                  <>
                    <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                      Hay que saldar este monto antes de hacer check-out.
                    </p>
                    {isManagement ? (
                      <button type="button" onClick={() => setTransferOpen(o => !o)} className="btn-mini btn-mini-neutral mt-3">
                        Transferir a cuenta por cobrar de una empresa
                      </button>
                    ) : (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Solo un gerente/dueño puede transferir el saldo a cuenta por cobrar.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Sin saldo pendiente.</p>
                )}
              </div>
            )}

            {transferOpen && (
              <form onSubmit={handleTransfer} className="space-y-3 p-4 rounded-lg" style={{ background: 'var(--surface-4)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Salda el folio de la estadía y registra la deuda contra una empresa con pago diferido.
                </p>
                <div>
                  <label className="label">Empresa</label>
                  <select
                    className="input"
                    value={transferCompanyId}
                    onChange={e => setTransferCompanyId(e.target.value)}
                    required
                  >
                    <option value="">Seleccioná una empresa…</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                  </select>
                  {companies.length === 0 && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      No hay clientes marcados como empresa (kind = COMPANY) — creá o editá un cliente para marcarlo.
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Notas (opcional)</label>
                  <input
                    className="input"
                    placeholder="Ej: OC #123, referencia interna"
                    value={transferNotes}
                    onChange={e => setTransferNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setTransferOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                  <button type="submit" disabled={transferring || !transferCompanyId} className="btn-primary flex-1">
                    {transferring ? <span className="spinner" /> : null}
                    Transferir
                  </button>
                </div>
              </form>
            )}

            <div>
              <label className="label">Turno de limpieza siguiente (opcional)</label>
              <select
                className="input"
                value={checkOutForm.nextCleaningShift}
                onChange={e => setCheckOutForm(f => ({ ...f, nextCleaningShift: e.target.value as Shift | '' }))}
              >
                <option value="">Por defecto (Mañana)</option>
                {(Object.keys(SHIFT_LABEL) as Shift[]).map(s => <option key={s} value={s}>{SHIFT_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Notas (opcional)</label>
              <textarea className="input" rows={2} value={checkOutForm.notes} onChange={e => setCheckOutForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Al confirmar se crea automáticamente la tarea de limpieza post-checkout.</p>
            <button
              type="button"
              onClick={handleCheckOut}
              disabled={checkingOut || loadingFolio || (folio?.balance ?? 0) > 0}
              className="btn-primary w-full"
              title={(folio?.balance ?? 0) > 0 ? 'Saldá o transferí el saldo antes de continuar' : undefined}
            >
              {checkingOut ? <span className="spinner" /> : null}
              Confirmar check-out
            </button>
          </div>
        </div>

        {/* ── Zona de riesgo ── */}
        <div className="card">
          <div className="detail-card-header">No show</div>
          <div className="detail-card-body">
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              El huésped no se presentó — cierra la estadía sin check-out.
            </p>
            <button type="button" onClick={() => setConfirmNoShow(true)} className="btn-mini btn-mini-danger">
              Marcar como no show
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmNoShow}
        onClose={() => setConfirmNoShow(false)}
        onConfirm={handleNoShow}
        title="¿Marcar como no show?"
        description={`${getCustomerName(stay.customerId)} no se presentó. La estadía se cierra sin check-out.`}
        confirmLabel="Marcar no show"
        variant="danger"
        loading={noShowing}
      />
    </div>
  )
}
