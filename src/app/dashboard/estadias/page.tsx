'use client'
import { useState, useEffect, useCallback } from 'react'
import { staysApi, resourcesApi, customersApi, reservationsApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import type { PaginatedResponse } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Stay, Resource, Customer, Reservation, Shift } from '@/lib/types'

const SHIFT_LABEL: Record<Shift, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function toArray<T>(res: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(res) ? res : res.data
}

export default function EstadiasPage() {
  const { toast } = useToast()
  const [stays, setStays] = useState<Stay[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [confirmedReservations, setConfirmedReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [checkInOpen, setCheckInOpen] = useState(false)
  const [checkInForm, setCheckInForm] = useState({ reservationId: '', resourceId: '', notes: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [checkOutTarget, setCheckOutTarget] = useState<Stay | null>(null)
  const [checkOutForm, setCheckOutForm] = useState<{ notes: string; nextCleaningShift: Shift | '' }>({ notes: '', nextCleaningShift: '' })

  const [noShowTarget, setNoShowTarget] = useState<Stay | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r, c, res] = await Promise.all([
        staysApi.listActive(),
        resourcesApi.list(),
        customersApi.list(),
        reservationsApi.list({ status: 'CONFIRMED' }),
      ])
      setStays(s)
      setResources(r)
      setCustomers(toArray(c))
      setConfirmedReservations(toArray(res))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

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
      await staysApi.checkIn({
        reservationId: checkInForm.reservationId,
        resourceId: checkInForm.resourceId,
        ...(checkInForm.notes && { notes: checkInForm.notes }),
      })
      toast('Check-in realizado', 'success')
      setCheckInOpen(false)
      load()
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function openCheckOut(stay: Stay) {
    setCheckOutForm({ notes: '', nextCleaningShift: '' })
    setCheckOutTarget(stay)
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
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleNoShow() {
    if (!noShowTarget) return
    setActionLoading(noShowTarget.id)
    try {
      await staysApi.noShow(noShowTarget.id)
      toast('Marcado como no show', 'success')
      setNoShowTarget(null)
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Estadías</h1>
          <p className="text-sm text-slate-400 mt-0.5">Check-in y check-out de huéspedes</p>
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
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : stays.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <p className="text-slate-400 font-medium">Sin huéspedes en check-in</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Habitación</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Check-in</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {stays.map(s => (
                <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5 font-medium text-white">{getCustomerName(s.customerId)}</td>
                  <td className="px-4 py-3.5 text-slate-300">{getResourceName(s.resourceId)}</td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs tabular-nums">{fmt(s.checkedInAt)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openCheckOut(s)}
                        disabled={actionLoading !== null}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        Check-out
                      </button>
                      <button
                        onClick={() => setNoShowTarget(s)}
                        disabled={actionLoading !== null}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
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
              className={`input ${fieldErrors['reservationId'] ? 'border-red-500/60' : ''}`}
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
              <p className="mt-1 text-xs text-slate-500">No hay reservas confirmadas pendientes de check-in.</p>
            )}
            {fieldErrors['reservationId'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['reservationId']}</p>}
          </div>
          <div>
            <label className="label">Habitación asignada</label>
            <select
              className={`input ${fieldErrors['resourceId'] ? 'border-red-500/60' : ''}`}
              value={checkInForm.resourceId}
              onChange={e => setCheckInForm(f => ({ ...f, resourceId: e.target.value }))}
              required
            >
              <option value="">Seleccioná una habitación…</option>
              {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">Puede ser distinta a la reservada si hubo que reasignar.</p>
            {fieldErrors['resourceId'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['resourceId']}</p>}
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
            <p className="text-sm text-slate-300">
              {getCustomerName(checkOutTarget.customerId)} — {getResourceName(checkOutTarget.resourceId)}
            </p>
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
            <p className="text-xs text-slate-500">Al confirmar se crea automáticamente la tarea de limpieza post-checkout.</p>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setCheckOutTarget(null)} className="btn-secondary flex-1">Cancelar</button>
              <button type="button" onClick={handleCheckOut} disabled={actionLoading !== null} className="btn-primary flex-1">
                {actionLoading !== null ? <span className="spinner" /> : null}
                Confirmar check-out
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={noShowTarget !== null}
        onClose={() => setNoShowTarget(null)}
        onConfirm={handleNoShow}
        title="¿Marcar como no show?"
        description={`${noShowTarget ? getCustomerName(noShowTarget.customerId) : ''} no se presentó. La estadía se cierra sin check-out.`}
        confirmLabel="Marcar no show"
        variant="danger"
        loading={actionLoading !== null}
      />
    </div>
  )
}
