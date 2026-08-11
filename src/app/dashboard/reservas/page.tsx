'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { reservationsApi, resourcesApi, customersApi, bookableServicesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import type { PaginatedResponse } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import type { Reservation, Resource, ReservationStatus, BookableService } from '@/lib/types'

const PAGE_SIZE = 20

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

const ALL_STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Normaliza la respuesta del API que puede venir paginada o como array plano */
function toArray<T>(res: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(res) ? res : res.data
}

export default function ReservasPage() {
  const { toast } = useToast()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [services, setServices] = useState<BookableService[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filtros y paginación
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ReservationStatus | ''>('')
  const [page, setPage] = useState(1)

  // Modal nueva reserva
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ resourceId: '', customerEmail: '', startTime: '', endTime: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Modal detalle / edición
  const [detailTarget, setDetailTarget] = useState<Reservation | null>(null)
  const [editingDetail, setEditingDetail] = useState(false)
  const [detailForm, setDetailForm] = useState({ startTime: '', endTime: '' })
  const [detailFieldErrors, setDetailFieldErrors] = useState<Record<string, string>>({})
  const [detailSubmitting, setDetailSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, recs, svcs] = await Promise.all([
        reservationsApi.list(),
        resourcesApi.list(),
        bookableServicesApi.list(),
      ])
      setReservations(toArray(res))
      setResources(recs)
      setServices(svcs)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  // Filtrado y paginación en cliente
  const filtered = useMemo(() => {
    let list = reservations
    if (filterStatus) list = list.filter(r => r.status === filterStatus)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r =>
        r.customer.fullName?.toLowerCase().includes(q) ||
        r.customer.email?.toLowerCase().includes(q)
      )
    }
    return list
  }, [reservations, filterStatus, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Resetear página al cambiar filtros
  useEffect(() => { setPage(1) }, [search, filterStatus])

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
      const customer = await customersApi.findByEmail(form.customerEmail)
      if (!customer) {
        toast('Cliente no encontrado. Crealo primero en la sección Clientes.', 'error')
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

  function openModal() {
    setForm({ resourceId: '', customerEmail: '', startTime: '', endTime: '' })
    setFieldErrors({})
    setModalOpen(true)
  }

  const getResourceName = (id: string) =>
    resources.find(r => r.id === id)?.name ?? id.slice(0, 8) + '…'

  const getServiceName = (id?: string | null) =>
    id ? services.find(s => s.id === id)?.name ?? id.slice(0, 8) + '…' : null

  /** input datetime-local necesita "YYYY-MM-DDTHH:mm", sin segundos ni Z */
  function toLocalInput(iso: string) {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  function openDetail(r: Reservation) {
    setDetailTarget(r)
    setEditingDetail(false)
    setDetailForm({ startTime: toLocalInput(r.startTime), endTime: toLocalInput(r.endTime) })
    setDetailFieldErrors({})
  }

  async function handleUpdateDetail(e: React.FormEvent) {
    e.preventDefault()
    if (!detailTarget) return
    setDetailSubmitting(true)
    setDetailFieldErrors({})
    try {
      const updated = await reservationsApi.update(detailTarget.id, {
        startTime: new Date(detailForm.startTime).toISOString(),
        endTime: new Date(detailForm.endTime).toISOString(),
      })
      toast('Reserva actualizada', 'success')
      setDetailTarget(updated)
      setEditingDetail(false)
      load()
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setDetailFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setDetailSubmitting(false)
    }
  }

  async function doDetailAction(action: 'confirm' | 'cancel' | 'complete') {
    if (!detailTarget) return
    setActionLoading(`${detailTarget.id}-${action}`)
    try {
      const labels = { confirm: 'Reserva confirmada', cancel: 'Reserva cancelada', complete: 'Reserva completada' }
      const updated = await reservationsApi[action](detailTarget.id)
      toast(labels[action], 'success')
      setDetailTarget(updated)
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Reservas</h1>
          <p className="text-sm text-slate-400 mt-0.5">Historial y gestión de reservas</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva reserva
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          className="input flex-1 min-w-[200px] max-w-xs"
          placeholder="Buscar cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input w-44"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as ReservationStatus | '')}
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-slate-400 font-medium">
            {search || filterStatus ? 'Sin resultados para ese filtro' : 'Sin reservas'}
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Recurso</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Inicio</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Fin</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {paginated.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r)}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
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
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
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

      {/* Modal nueva reserva — usa <Modal> base */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva reserva"
      >
        <form onSubmit={handleCreateReservation} className="p-6 space-y-4">
          <div>
            <label className="label">Recurso</label>
            <select
              className="input"
              value={form.resourceId}
              onChange={e => setForm(f => ({ ...f, resourceId: e.target.value }))}
              required
            >
              <option value="">Seleccioná un recurso…</option>
              {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {fieldErrors['resourceId'] && (
              <p className="mt-1 text-xs text-red-400">{fieldErrors['resourceId']}</p>
            )}
          </div>
          <div>
            <label className="label">Email del cliente</label>
            <input
              type="email"
              className="input"
              value={form.customerEmail}
              onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
              placeholder="cliente@email.com"
              required
            />
            <p className="mt-1 text-xs text-slate-500">El cliente debe estar registrado en el sistema.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Inicio</label>
              <input
                type="datetime-local"
                className="input"
                value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Fin</label>
              <input
                type="datetime-local"
                className="input"
                value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <span className="spinner" /> : null}
              Crear reserva
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal detalle / edición */}
      {detailTarget && (
        <Modal
          open={detailTarget !== null}
          onClose={() => setDetailTarget(null)}
          title={editingDetail ? 'Editar reserva' : 'Detalle de reserva'}
        >
          {editingDetail ? (
            <form onSubmit={handleUpdateDetail} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Inicio</label>
                  <input
                    type="datetime-local"
                    className={`input ${detailFieldErrors['startTime'] ? 'border-red-500/60' : ''}`}
                    value={detailForm.startTime}
                    onChange={e => setDetailForm(f => ({ ...f, startTime: e.target.value }))}
                    required
                  />
                  {detailFieldErrors['startTime'] && <p className="mt-1 text-xs text-red-400">{detailFieldErrors['startTime']}</p>}
                </div>
                <div>
                  <label className="label">Fin</label>
                  <input
                    type="datetime-local"
                    className={`input ${detailFieldErrors['endTime'] ? 'border-red-500/60' : ''}`}
                    value={detailForm.endTime}
                    onChange={e => setDetailForm(f => ({ ...f, endTime: e.target.value }))}
                    required
                  />
                  {detailFieldErrors['endTime'] && <p className="mt-1 text-xs text-red-400">{detailFieldErrors['endTime']}</p>}
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Cliente, recurso y servicio no se pueden cambiar acá — cancelá esta reserva y creá una nueva si hace falta.
              </p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingDetail(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={detailSubmitting} className="btn-primary flex-1">
                  {detailSubmitting ? <span className="spinner" /> : null}
                  Guardar cambios
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Cliente</p>
                  <p className="text-sm text-white font-medium">{detailTarget.customer.fullName}</p>
                  <p className="text-xs text-slate-500">{detailTarget.customer.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Estado</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[detailTarget.status]}`}>
                    {STATUS_LABEL[detailTarget.status]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Recurso</p>
                  <p className="text-sm text-slate-200">{getResourceName(detailTarget.resourceId)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Servicio</p>
                  <p className="text-sm text-slate-200">{getServiceName(detailTarget.serviceId) ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Inicio</p>
                  <p className="text-sm text-slate-200 tabular-nums">{fmt(detailTarget.startTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Fin</p>
                  <p className="text-sm text-slate-200 tabular-nums">{fmt(detailTarget.endTime)}</p>
                </div>
                {detailTarget.partySize != null && detailTarget.partySize > 1 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Personas</p>
                    <p className="text-sm text-slate-200">{detailTarget.partySize}</p>
                  </div>
                )}
              </div>

              {detailTarget.notes && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Notas</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{detailTarget.notes}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
                {detailTarget.status === 'PENDING' && (
                  <button
                    onClick={() => setEditingDetail(true)}
                    className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] transition-colors"
                  >
                    Editar horario
                  </button>
                )}
                {detailTarget.status === 'PENDING' && (
                  <button
                    onClick={() => doDetailAction('confirm')}
                    disabled={actionLoading !== null}
                    className="text-xs px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                )}
                {(detailTarget.status === 'PENDING' || detailTarget.status === 'CONFIRMED') && (
                  <button
                    onClick={() => doDetailAction('cancel')}
                    disabled={actionLoading !== null}
                    className="text-xs px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    Cancelar reserva
                  </button>
                )}
                {detailTarget.status === 'CONFIRMED' && (
                  <button
                    onClick={() => doDetailAction('complete')}
                    disabled={actionLoading !== null}
                    className="text-xs px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                  >
                    Completar
                  </button>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
