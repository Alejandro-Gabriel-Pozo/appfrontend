'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useToast } from '@/context/ToastContext'
import {
  customerReservationsApi,
  customerCategoriesApi,
  customerBookableServicesApi,
  availabilityApi,
  extractErrorMessage,
  type ApiErrorWithStatus,
} from '@/lib/customerApi'
import { readPendingBooking, clearPendingBooking } from '@/lib/pendingBooking'
import type {
  Reservation, ReservationStatus, Category, BookableService, AvailabilityResource,
} from '@/lib/types'

const STATUS_BADGE: Record<ReservationStatus, string> = {
  PENDING: 'badge-pending', CONFIRMED: 'badge-confirmed', COMPLETED: 'badge-completed', CANCELLED: 'badge-cancelled',
}
const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmada', COMPLETED: 'Completada', CANCELLED: 'Cancelada',
}
const CANCELLABLE: ReservationStatus[] = ['PENDING', 'CONFIRMED']

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localToIso(local: string): string {
  return new Date(local).toISOString()
}
function addMinutesIso(startIso: string, minutes: number): string {
  const d = new Date(startIso)
  d.setMinutes(d.getMinutes() + minutes)
  return d.toISOString()
}
function fmt(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short', hour12: false })
}

const NO_SERVICE = '__none__'

export default function MisReservasPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.businessSlug as string
  const { toast } = useToast()

  const [reservations, setReservations] = useState<Reservation[] | null>(null)
  const [listError, setListError] = useState('')

  const load = useCallback(() => {
    customerReservationsApi.list()
      .then(setReservations)
      .catch(err => setListError(extractErrorMessage(err)))
  }, [])

  useEffect(() => { load() }, [load])

  // ─── Crear reserva ───────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [services, setServices] = useState<BookableService[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [available, setAvailable] = useState<AvailabilityResource[] | null>(null)
  const [searchingAvail, setSearchingAvail] = useState(false)
  const [createError, setCreateError] = useState('')
  const [bookingResourceId, setBookingResourceId] = useState<string | null>(null)

  // Modo "confirmar" — llega desde disponibilidad/page.tsx con resourceId ya
  // elegido (pending-booking), sin pasar por el wizard de categoría/servicio.
  const [confirmPrefill, setConfirmPrefill] = useState<{
    resourceId: string; categoryId: string; startTime: string; endTime: string
  } | null>(null)

  useEffect(() => {
    // Se lee directo de window.location en vez de useSearchParams() para no
    // arrastrar el requisito de <Suspense> de Next — esto es un one-shot al
    // montar la página, no algo que necesite reaccionar a cambios de URL.
    const qs = new URLSearchParams(window.location.search)
    if (qs.get('prefill') !== '1') return
    const pending = readPendingBooking()
    clearPendingBooking()
    if (!pending) return
    setConfirmPrefill(pending)
    setCreateOpen(true)
    router.replace(`/portal/${slug}/cuenta/reservas`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openCreate() {
    setConfirmPrefill(null)
    setCategoryId('')
    setServiceId('')
    setStartLocal('')
    setEndLocal('')
    setAvailable(null)
    setCreateError('')
    setCreateOpen(true)
    if (categories.length === 0) {
      customerCategoriesApi.list().then(setCategories).catch(() => { /* no crítico */ })
    }
    if (services.length === 0) {
      customerBookableServicesApi.list().then(setServices).catch(() => { /* no crítico */ })
    }
  }

  const selectedService = services.find(s => s.id === serviceId)
  const hasFixedDuration = !!selectedService && selectedService.durationMinutes != null
  const servicesInCategory = services.filter(s => s.categoryId === categoryId && s.active)

  async function searchAvailability() {
    if (!categoryId || !startLocal) return
    if (!hasFixedDuration && !endLocal) return
    setSearchingAvail(true)
    setCreateError('')
    setAvailable(null)
    try {
      const startIso = localToIso(startLocal)
      const endIso = hasFixedDuration
        ? addMinutesIso(startIso, selectedService!.durationMinutes!)
        : localToIso(endLocal)
      const res = await availabilityApi.search(slug, { startTime: startIso, endTime: endIso, categoryId })
      setAvailable(res.available)
    } catch (err: unknown) {
      setCreateError(extractErrorMessage(err))
    } finally {
      setSearchingAvail(false)
    }
  }

  async function bookResource(resourceId: string) {
    setBookingResourceId(resourceId)
    setCreateError('')
    try {
      const startIso = localToIso(startLocal)
      const endIso = hasFixedDuration
        ? addMinutesIso(startIso, selectedService!.durationMinutes!)
        : localToIso(endLocal)
      const isNoService = serviceId === NO_SERVICE
      await customerReservationsApi.create({
        categoryId,
        resourceId,
        startTime: startIso,
        // Duración fija: mandamos solo serviceId, el backend deriva el fin
        // (no se puede pisar la duración de un servicio con endTime).
        // Duración variable con servicio elegido: mandamos ambos, para no
        // perder la asociación al servicio. Sin servicio: solo endTime.
        ...(isNoService ? { endTime: endIso } : hasFixedDuration ? { serviceId } : { serviceId, endTime: endIso }),
      })
      toast('Reserva creada', 'success')
      setCreateOpen(false)
      load()
    } catch (err: unknown) {
      setCreateError(extractErrorMessage(err))
    } finally {
      setBookingResourceId(null)
    }
  }

  async function confirmPrefillBooking() {
    if (!confirmPrefill) return
    setBookingResourceId(confirmPrefill.resourceId)
    setCreateError('')
    try {
      await customerReservationsApi.create({
        categoryId: confirmPrefill.categoryId,
        resourceId: confirmPrefill.resourceId,
        startTime: confirmPrefill.startTime,
        endTime: confirmPrefill.endTime,
      })
      toast('Reserva creada', 'success')
      setCreateOpen(false)
      load()
    } catch (err: unknown) {
      setCreateError(extractErrorMessage(err))
    } finally {
      setBookingResourceId(null)
    }
  }

  // ─── Editar reserva (solo PENDING) ───────────────────────────────────────
  const [editing, setEditing] = useState<Reservation | null>(null)
  const [editStartLocal, setEditStartLocal] = useState('')
  const [editEndLocal, setEditEndLocal] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  function openEdit(r: Reservation) {
    setEditing(r)
    setEditStartLocal(toLocalInput(r.startTime))
    setEditEndLocal(toLocalInput(r.endTime))
    setEditError('')
  }

  async function saveEdit() {
    if (!editing) return
    setEditSaving(true)
    setEditError('')
    try {
      const originalDurationMs = new Date(editing.endTime).getTime() - new Date(editing.startTime).getTime()
      const newStartIso = localToIso(editStartLocal)
      // Si la reserva tiene serviceId, la duración no es editable — se
      // recalcula el fin a partir del original para no cambiarla en
      // silencio al mover el inicio.
      const newEndIso = editing.serviceId
        ? new Date(new Date(newStartIso).getTime() + originalDurationMs).toISOString()
        : localToIso(editEndLocal)
      await customerReservationsApi.update(editing.id, { startTime: newStartIso, endTime: newEndIso })
      toast('Reserva actualizada', 'success')
      setEditing(null)
      load()
    } catch (err: unknown) {
      setEditError(extractErrorMessage(err))
    } finally {
      setEditSaving(false)
    }
  }

  // ─── Cancelar reserva ─────────────────────────────────────────────────────
  const [cancelling, setCancelling] = useState<Reservation | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  async function confirmCancel() {
    if (!cancelling) return
    setCancelLoading(true)
    try {
      await customerReservationsApi.cancel(cancelling.id)
      toast('Reserva cancelada', 'success')
      setCancelling(null)
      load()
    } catch (err: unknown) {
      const e = err as ApiErrorWithStatus
      if (e.code === 'CANCELLATION_TOO_LATE') {
        toast(e.message, 'error')
      } else {
        toast(extractErrorMessage(err), 'error')
      }
      setCancelling(null)
    } finally {
      setCancelLoading(false)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mis reservas</h1>
          <p className="page-subtitle">Gestioná tus reservas</p>
        </div>
        <button onClick={openCreate} className="btn-primary">Nueva reserva</button>
      </div>

      {listError && <div className="alert alert-danger mb-6">{listError}</div>}

      {reservations === null && !listError && (
        <div className="flex justify-center py-16"><span className="spinner" /></div>
      )}

      {reservations && reservations.length === 0 && (
        <div className="empty-state">
          <h3>Todavía no tenés reservas</h3>
          <p>Creá tu primera reserva con el botón de arriba.</p>
        </div>
      )}

      {reservations && reservations.length > 0 && (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reservations.map(r => (
                  <tr key={r.id}>
                    <td className="table-cell-primary">{fmt(r.startTime)}</td>
                    <td>{fmt(r.endTime)}</td>
                    <td><span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        {r.status === 'PENDING' && (
                          <button onClick={() => openEdit(r)} className="btn-ghost">Editar</button>
                        )}
                        {CANCELLABLE.includes(r.status) && (
                          <button onClick={() => setCancelling(r)} className="btn-ghost" style={{ color: 'var(--danger)' }}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Modal: nueva reserva ─────────────────────────────────────────── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva reserva" size="max-w-lg">
        {confirmPrefill ? (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Confirmá la reserva que elegiste en disponibilidad:
            </p>
            <div className="card p-3 text-sm">
              <div><strong>Desde:</strong> {fmt(confirmPrefill.startTime)}</div>
              <div><strong>Hasta:</strong> {fmt(confirmPrefill.endTime)}</div>
            </div>
            {createError && <div className="alert alert-danger">{createError}</div>}
            <button
              onClick={confirmPrefillBooking}
              disabled={bookingResourceId !== null}
              className="btn-primary w-full"
            >
              {bookingResourceId ? <><span className="spinner" /> Confirmando…</> : 'Confirmar reserva'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Categoría</label>
              <select
                value={categoryId}
                onChange={e => { setCategoryId(e.target.value); setServiceId(''); setAvailable(null) }}
                className="input"
              >
                <option value="">Elegí una categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {categoryId && (
              <div>
                <label className="label">Servicio</label>
                <select
                  value={serviceId}
                  onChange={e => { setServiceId(e.target.value); setAvailable(null) }}
                  className="input"
                >
                  <option value="">Elegí un servicio</option>
                  {servicesInCategory.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.durationMinutes != null ? ` (${s.durationMinutes} min)` : ' (horario a elección)'}
                    </option>
                  ))}
                  <option value={NO_SERVICE}>Sin servicio — elijo el horario</option>
                </select>
              </div>
            )}

            {serviceId && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="label">Inicio</label>
                  <input
                    type="datetime-local"
                    value={startLocal}
                    onChange={e => { setStartLocal(e.target.value); setAvailable(null) }}
                    className="input"
                  />
                </div>
                {!hasFixedDuration && (
                  <div className="flex-1">
                    <label className="label">Fin</label>
                    <input
                      type="datetime-local"
                      value={endLocal}
                      onChange={e => { setEndLocal(e.target.value); setAvailable(null) }}
                      className="input"
                    />
                  </div>
                )}
              </div>
            )}

            {serviceId && startLocal && (hasFixedDuration || endLocal) && (
              <button onClick={searchAvailability} disabled={searchingAvail} className="btn-secondary w-full">
                {searchingAvail ? <><span className="spinner" /> Buscando…</> : 'Ver disponibilidad'}
              </button>
            )}

            {createError && <div className="alert alert-danger">{createError}</div>}

            {available && available.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Nada disponible en ese horario.</p>
            )}

            {available && available.length > 0 && (
              <div className="space-y-2">
                {available.map(r => (
                  <div key={r.id} className="card p-3 flex items-center justify-between">
                    <div>
                      <div className="table-cell-primary text-sm">{r.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>${r.basePrice.toLocaleString('es-AR')}</div>
                    </div>
                    <button
                      onClick={() => bookResource(r.id)}
                      disabled={bookingResourceId !== null}
                      className="btn-primary"
                    >
                      {bookingResourceId === r.id ? <span className="spinner" /> : 'Reservar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ─── Modal: editar reserva ────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar reserva">
        {editing && (
          <div className="space-y-4">
            <div>
              <label className="label">Inicio</label>
              <input
                type="datetime-local"
                value={editStartLocal}
                onChange={e => setEditStartLocal(e.target.value)}
                className="input"
              />
            </div>
            {!editing.serviceId && (
              <div>
                <label className="label">Fin</label>
                <input
                  type="datetime-local"
                  value={editEndLocal}
                  onChange={e => setEditEndLocal(e.target.value)}
                  className="input"
                />
              </div>
            )}
            {editing.serviceId && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Esta reserva tiene un servicio con duración fija — solo podés mover el horario de inicio.
              </p>
            )}
            {editError && <div className="alert alert-danger">{editError}</div>}
            <button onClick={saveEdit} disabled={editSaving} className="btn-primary w-full">
              {editSaving ? <><span className="spinner" /> Guardando…</> : 'Guardar cambios'}
            </button>
          </div>
        )}
      </Modal>

      {/* ─── Confirm: cancelar reserva ────────────────────────────────────── */}
      <ConfirmDialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
        title="Cancelar reserva"
        description="¿Seguro que querés cancelar esta reserva? Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar"
        variant="danger"
        loading={cancelLoading}
      />
    </div>
  )
}
