'use client'
import { useState, useEffect, useCallback } from 'react'
import { reservationsApi, resourcesApi, customersApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { Reservation, Resource, ReservationStatus } from '@/lib/types'

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
}

const STATUS_CLASS: Record<ReservationStatus, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-400',
  CONFIRMED: 'bg-emerald-500/10 text-emerald-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
  COMPLETED: 'bg-blue-500/10 text-blue-400',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ReservasPage() {
  const { toast } = useToast()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Modal nueva reserva
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ resourceId: '', customerEmail: '', startTime: '', endTime: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, recs] = await Promise.all([reservationsApi.list(), resourcesApi.list()])
      setReservations(res)
      setResources(recs)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function doAction(id: string, action: 'confirm' | 'cancel' | 'complete') {
    setActionLoading(`${id}-${action}`)
    try {
      await reservationsApi[action](id)
      const labels = { confirm: 'Reserva confirmada', cancel: 'Reserva cancelada', complete: 'Reserva completada' }
      toast(labels[action], 'success')
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCreateReservation(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      // Buscar o crear cliente por email
      let customer = await customersApi.findByEmail(form.customerEmail)
      if (!customer) {
        toast('Cliente no encontrado. Crealo primero en la sección Clientes.', 'error')
        setSubmitting(false)
        return
      }
      await reservationsApi.create({
        resourceId: form.resourceId,
        customer: { id: customer.id },
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      })
      toast('Reserva creada', 'success')
      setModalOpen(false)
      setForm({ resourceId: '', customerEmail: '', startTime: '', endTime: '' })
      load()
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const getResourceName = (id: string) => resources.find(r => r.id === id)?.name ?? id.slice(0, 8) + '…'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Reservas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Historial y gestión de reservas</p>
        </div>
        <button onClick={() => { setModalOpen(true); setFieldErrors({}) }} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva reserva
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-white/[0.04] animate-pulse" />)}</div>
      ) : reservations.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-slate-400 font-medium">Sin reservas</p>
          <p className="text-slate-600 text-sm mt-1">Creá la primera con el botón de arriba</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Recurso</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Inicio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Fin</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {reservations.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-white">{r.customer.fullName}</p>
                    <p className="text-xs text-slate-500">{r.customer.email}</p>
                  </td>
                  <td className="px-4 py-3.5 text-slate-300">{getResourceName(r.resourceId)}</td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs tabular-nums">{fmt(r.startTime)}</td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs tabular-nums">{fmt(r.endTime)}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === 'PENDING' && (
                        <button
                          onClick={() => doAction(r.id, 'confirm')}
                          disabled={actionLoading !== null}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `${r.id}-confirm` ? '…' : 'Confirmar'}
                        </button>
                      )}
                      {(r.status === 'PENDING' || r.status === 'CONFIRMED') && (
                        <button
                          onClick={() => doAction(r.id, 'cancel')}
                          disabled={actionLoading !== null}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `${r.id}-cancel` ? '…' : 'Cancelar'}
                        </button>
                      )}
                      {r.status === 'CONFIRMED' && (
                        <button
                          onClick={() => doAction(r.id, 'complete')}
                          disabled={actionLoading !== null}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `${r.id}-complete` ? '…' : 'Completar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nueva reserva */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1d27] rounded-xl border border-white/[0.08] w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold text-white">Nueva reserva</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-white" aria-label="Cerrar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateReservation} className="p-6 space-y-4">
              <div>
                <label className="label">Recurso</label>
                <select className="input" value={form.resourceId} onChange={e => setForm(f => ({ ...f, resourceId: e.target.value }))} required>
                  <option value="">Seleccioná un recurso…</option>
                  {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                {fieldErrors['resourceId'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['resourceId']}</p>}
              </div>
              <div>
                <label className="label">Email del cliente</label>
                <input type="email" className="input" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} placeholder="cliente@email.com" required />
                <p className="mt-1 text-xs text-slate-500">El cliente debe estar registrado en el sistema.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Inicio</label>
                  <input type="datetime-local" className="input" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Fin</label>
                  <input type="datetime-local" className="input" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} required />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? <span className="spinner" /> : null}
                  Crear reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
