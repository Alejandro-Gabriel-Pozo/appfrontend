'use client'
import { useState, useEffect, useCallback } from 'react'
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { useTable, useCreate, useInvalidate } from '@refinedev/core'
import { staysApi, resourcesApi, customersApi, reservationsApi, categoriesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import type { PaginatedResponse } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/Modal'
import type { Stay, Resource, Customer, Reservation, Shift, StayFolio } from '@/lib/types'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Tercera pantalla migrada (18/08/2026) — módulo PMS, acento brass.
const fraunces = Fraunces({ subsets: ['latin'], weight: ['300', '500', '600'], variable: '--font-bastion-serif' })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-bastion-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-bastion-mono' })

const SHIFT_LABEL: Record<Shift, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

const fmtMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false })
}

function toArray<T>(res: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(res) ? res : res.data
}

export default function EstadiasPage() {
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const isManagement = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN'
  // Sin paginación server-side todavía (ver lib/refine/dataProvider.ts).
  const { result, tableQuery } = useTable<Stay>({ resource: 'estadias', pagination: { mode: 'off' } })
  const stays = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: checkInMutation } = useCreate<Stay>()
  // checkOut/noShow son acciones con nombre (staysApi.checkOut/noShow) que
  // no pasan por el data provider — invalidate() fuerza el refetch después.
  const invalidate = useInvalidate()

  const [resources, setResources] = useState<Resource[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [confirmedReservations, setConfirmedReservations] = useState<Reservation[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [checkInOpen, setCheckInOpen] = useState(false)
  const [checkInForm, setCheckInForm] = useState({ reservationId: '', resourceId: '', notes: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [checkOutTarget, setCheckOutTarget] = useState<Stay | null>(null)
  const [checkOutForm, setCheckOutForm] = useState<{ notes: string; nextCleaningShift: Shift | '' }>({ notes: '', nextCleaningShift: '' })
  const [folio, setFolio] = useState<StayFolio | null>(null)
  const [loadingFolio, setLoadingFolio] = useState(false)

  const [transferOpen, setTransferOpen] = useState(false)
  const [transferCompanyId, setTransferCompanyId] = useState('')
  const [transferNotes, setTransferNotes] = useState('')
  const [transferring, setTransferring] = useState(false)

  const [noShowTarget, setNoShowTarget] = useState<Stay | null>(null)

  const companies = customers.filter(c => c.kind === 'COMPANY')

  // Recursos/clientes/reservas confirmadas no están migrados a esta pantalla
  // — se siguen trayendo directo, igual que antes.
  const loadCatalog = useCallback(async () => {
    try {
      const [r, c, res, cats] = await Promise.all([
        resourcesApi.list(),
        customersApi.list(),
        reservationsApi.list({ status: 'CONFIRMED' }),
        categoriesApi.list(),
      ])
      setResources(r)
      setCustomers(toArray(c))
      // Backlog E1 (13/08/2026, alcance completo 18/08) — red de seguridad:
      // el dropdown de check-in solo debería ofrecer reservas de alojamiento
      // (Reservas ya filtra esto al crear, pero una reserva vieja de un
      // servicio, creada antes de este cambio, no debería colarse acá).
      const lodgingCategoryIds = new Set(cats.filter(cat => cat.isLodging).map(cat => cat.id))
      const lodgingResourceIds = new Set(r.filter(res2 => lodgingCategoryIds.has(res2.categoryId)).map(res2 => res2.id))
      setConfirmedReservations(toArray(res).filter(rv => lodgingResourceIds.has(rv.resourceId)))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }, [toast])

  useEffect(() => { queueMicrotask(loadCatalog) }, [loadCatalog])

  const getResourceName = (id: string) => resources.find(r => r.id === id)?.name ?? id.slice(0, 8) + '…'
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.fullName ?? id.slice(0, 8) + '…'

  function openCheckIn() {
    setCheckInForm({ reservationId: '', resourceId: '', notes: '' })
    setFieldErrors({})
    setCheckInOpen(true)
  }

  function pickReservation(reservationId: string) {
    const reservation = confirmedReservations.find(r => r.id === reservationId)
    setCheckInForm(f => ({ ...f, reservationId, resourceId: reservation?.resourceId ?? f.resourceId }))
  }

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      await checkInMutation({
        resource: 'estadias',
        values: {
          reservationId: checkInForm.reservationId,
          resourceId: checkInForm.resourceId,
          ...(checkInForm.notes && { notes: checkInForm.notes }),
        },
      })
      toast('Check-in realizado', 'success')
      setCheckInOpen(false)
      // El check-in saca la reserva usada de "confirmadas" — recargar el catálogo.
      loadCatalog()
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function loadFolio(stayId: string) {
    setLoadingFolio(true)
    try {
      const f = await staysApi.getFolio(stayId)
      setFolio(f)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoadingFolio(false)
    }
  }

  function openCheckOut(stay: Stay) {
    setCheckOutForm({ notes: '', nextCleaningShift: '' })
    setFolio(null)
    setCheckOutTarget(stay)
    loadFolio(stay.id)
  }

  async function handleCheckOut() {
    if (!checkOutTarget) return
    setActionLoading(checkOutTarget.id)
    try {
      await staysApi.checkOut(checkOutTarget.id, {
        ...(checkOutForm.notes && { notes: checkOutForm.notes }),
        ...(checkOutForm.nextCleaningShift && { nextCleaningShift: checkOutForm.nextCleaningShift }),
      })
      toast('Check-out realizado — se planificó la limpieza', 'success')
      setCheckOutTarget(null)
      invalidate({ resource: 'estadias', invalidates: ['list'] })
    } catch (err) {
      // El backend puede rechazar con 409 STAY_BALANCE_OWED aunque el
      // folio mostrado diga $0 (ej. un cargo nuevo llegó justo antes) —
      // recargamos el folio para que el mensaje que ve el usuario sea
      // consistente con lo que el backend acaba de evaluar.
      toast(extractErrorMessage(err), 'error')
      loadFolio(checkOutTarget.id)
    } finally {
      setActionLoading(null)
    }
  }

  function openTransfer() {
    setTransferCompanyId('')
    setTransferNotes('')
    setTransferOpen(true)
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault()
    if (!checkOutTarget || !transferCompanyId) return
    setTransferring(true)
    try {
      await staysApi.transferToReceivable(checkOutTarget.id, {
        companyCustomerId: transferCompanyId,
        ...(transferNotes && { notes: transferNotes }),
      })
      toast('Saldo transferido a cuenta por cobrar', 'success')
      setTransferOpen(false)
      loadFolio(checkOutTarget.id)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setTransferring(false)
    }
  }

  async function handleNoShow() {
    if (!noShowTarget) return
    setActionLoading(noShowTarget.id)
    try {
      await staysApi.noShow(noShowTarget.id)
      toast('Marcado como no show', 'success')
      setNoShowTarget(null)
      invalidate({ resource: 'estadias', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className={`bastion ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Estadías</h1>
          <p className="page-subtitle">Check-in y check-out de huéspedes</p>
        </div>
        <button onClick={openCheckIn} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo check-in
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg skeleton" />)}
        </div>
      ) : stays.length === 0 ? (
        <div className="card empty-state">
          <p>Sin huéspedes en check-in</p>
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Habitación</th>
                <th>Check-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stays.map(s => (
                <tr key={s.id}>
                  <td className="table-cell-primary">{getCustomerName(s.customerId)}</td>
                  <td>{getResourceName(s.resourceId)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmt(s.checkedInAt)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openCheckOut(s)}
                        disabled={actionLoading !== null}
                        className="btn-mini btn-mini-sage"
                      >
                        Check-out
                      </button>
                      <button
                        onClick={() => setNoShowTarget(s)}
                        disabled={actionLoading !== null}
                        className="btn-mini btn-mini-clay"
                      >
                        No show
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal check-in */}
      <Modal open={checkInOpen} onClose={() => setCheckInOpen(false)} title="Nuevo check-in">
        <form onSubmit={handleCheckIn} className="space-y-4">
          <div>
            <label className="label">Reserva confirmada</label>
            <select
              className="input"
              style={fieldErrors['reservationId'] ? { borderColor: 'var(--danger)' } : undefined}
              value={checkInForm.reservationId}
              onChange={e => pickReservation(e.target.value)}
              required
            >
              <option value="">Seleccioná una reserva…</option>
              {confirmedReservations.map(r => (
                <option key={r.id} value={r.id}>
                  {r.customer.fullName} — {getResourceName(r.resourceId)} — {fmt(r.startTime)}
                </option>
              ))}
            </select>
            {confirmedReservations.length === 0 && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>No hay reservas confirmadas pendientes de check-in.</p>
            )}
            {fieldErrors['reservationId'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['reservationId']}</p>}
          </div>
          <div>
            <label className="label">Habitación asignada</label>
            <select
              className="input"
              style={fieldErrors['resourceId'] ? { borderColor: 'var(--danger)' } : undefined}
              value={checkInForm.resourceId}
              onChange={e => setCheckInForm(f => ({ ...f, resourceId: e.target.value }))}
              required
            >
              <option value="">Seleccioná una habitación…</option>
              {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>Puede ser distinta a la reservada si hubo que reasignar.</p>
            {fieldErrors['resourceId'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['resourceId']}</p>}
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <textarea className="input" rows={2} value={checkInForm.notes} onChange={e => setCheckInForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCheckInOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <span className="spinner" /> : null}
              Confirmar check-in
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal check-out */}
      {checkOutTarget && (
        <Modal open={checkOutTarget !== null} onClose={() => setCheckOutTarget(null)} title="Check-out">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {getCustomerName(checkOutTarget.customerId)} — {getResourceName(checkOutTarget.resourceId)}
            </p>

            {/* Folio — saldo pendiente de la estadía (A1, paso 6) */}
            {loadingFolio ? (
              <div className="h-16 rounded-lg skeleton" />
            ) : folio && (
              <div className="card p-4">
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Saldo de la estadía</p>
                <p className="text-xl font-semibold" style={{ color: folio.balance > 0 ? 'var(--danger)' : 'var(--bastion-sage)' }}>
                  {fmtMoney(folio.balance)}
                </p>
                {folio.balance > 0 ? (
                  <>
                    <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                      Hay que saldar este monto antes de hacer check-out.
                    </p>
                    {isManagement && (
                      <button type="button" onClick={openTransfer} className="btn-mini btn-mini-neutral mt-3">
                        Transferir a cuenta por cobrar de una empresa
                      </button>
                    )}
                    {!isManagement && (
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
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setCheckOutTarget(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                type="button"
                onClick={handleCheckOut}
                disabled={actionLoading !== null || loadingFolio || (folio?.balance ?? 0) > 0}
                className="btn-primary flex-1"
                title={(folio?.balance ?? 0) > 0 ? 'Saldá o transferí el saldo antes de continuar' : undefined}
              >
                {actionLoading !== null ? <span className="spinner" /> : null}
                Confirmar check-out
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal transferir a cuenta por cobrar */}
      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transferir a cuenta por cobrar">
        <form onSubmit={handleTransfer} className="space-y-4">
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
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setTransferOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={transferring || !transferCompanyId} className="btn-primary flex-1">
              {transferring ? <span className="spinner" /> : null}
              Transferir
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmar no show — modal propio (no ConfirmDialog: es compartido
          por pantallas sin migrar, con colores hardcodeados fuera de Bastión). */}
      {noShowTarget && (
        <Modal open={noShowTarget !== null} onClose={() => setNoShowTarget(null)} title="¿Marcar como no show?" size="max-w-sm">
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {getCustomerName(noShowTarget.customerId)} no se presentó. La estadía se cierra sin check-out.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setNoShowTarget(null)} disabled={actionLoading !== null} className="btn-secondary flex-1">Cancelar</button>
            <button type="button" onClick={handleNoShow} disabled={actionLoading !== null} className="btn-danger flex-1">
              {actionLoading !== null ? <span className="spinner" /> : null}
              Marcar no show
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
