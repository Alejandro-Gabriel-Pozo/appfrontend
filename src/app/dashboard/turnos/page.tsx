'use client'
import { useState, useEffect, useMemo } from 'react'
import { useTable, useCreate, useUpdate, useInvalidate } from '@refinedev/core'
import { reservationsApi, resourcesApi, customersApi, bookableServicesApi, categoriesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import type { Reservation, Resource, ReservationStatus, BookableService, Category } from '@/lib/types'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Backlog E1 (13/08/2026, alcance completo 18/08) — separa el panel de
// servicios puntuales (Turnos) del de alojamiento (Reservas + Estadías).
// Es un clon deliberado de dashboard/reservas/page.tsx con el filtro de
// categoría invertido — mismo módulo core, sin gate, acento brass.

const PAGE_SIZE = 20

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
}

const STATUS_BADGE_CLASS: Record<ReservationStatus, string> = {
  PENDING: 'badge-pending',
  CONFIRMED: 'badge-confirmed',
  CANCELLED: 'badge-cancelled',
  COMPLETED: 'badge-completed',
}

const ALL_STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false })
}

const fmtMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format

export default function TurnosPage() {
  const { toast } = useToast()
  // Mismo recurso Refine 'reservas' que la pantalla de alojamiento — la
  // separación es 100% de filtrado client-side por categoría, no un
  // recurso de backend distinto (no existe tal cosa: es la misma entidad
  // Reservation para ambos paneles).
  const { result, tableQuery } = useTable<Reservation>({ resource: 'reservas', pagination: { mode: 'off' } })
  const reservations = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createReservation } = useCreate<Reservation>()
  const { mutateAsync: updateReservation } = useUpdate<Reservation>()
  const invalidate = useInvalidate()

  const [resources, setResources] = useState<Resource[]>([])
  const [services, setServices] = useState<BookableService[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filtros y paginación
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ReservationStatus | ''>('')
  const [page, setPage] = useState(1)

  // Modal nuevo turno
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ resourceId: '', serviceId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Turnos disponibles (servicios "slot" con horario configurado — Mi Negocio / recurso)
  const [slotDate, setSlotDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Modal detalle / edición
  const [detailTarget, setDetailTarget] = useState<Reservation | null>(null)
  const [editingDetail, setEditingDetail] = useState(false)
  const [detailForm, setDetailForm] = useState({ startTime: '', endTime: '' })
  const [detailFieldErrors, setDetailFieldErrors] = useState<Record<string, string>>({})
  const [detailSubmitting, setDetailSubmitting] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      Promise.all([resourcesApi.list(), bookableServicesApi.list(), categoriesApi.list()])
        .then(([recs, svcs, cats]) => { setResources(recs); setServices(svcs); setCategories(cats) })
        .catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

  // Inverso de dashboard/reservas: acá va todo lo que NO es alojamiento.
  const serviceCategoryIds = useMemo(
    () => new Set(categories.filter(c => !c.isLodging).map(c => c.id)),
    [categories],
  )
  const serviceResourceIds = useMemo(
    () => new Set(resources.filter(r => serviceCategoryIds.has(r.categoryId)).map(r => r.id)),
    [resources, serviceCategoryIds],
  )
  const serviceServices = useMemo(
    () => services.filter(s => serviceCategoryIds.has(s.categoryId)),
    [services, serviceCategoryIds],
  )

  // Filtrado y paginación en cliente
  const filtered = useMemo(() => {
    let list = reservations.filter(r => serviceResourceIds.has(r.resourceId))
    if (filterStatus) list = list.filter(r => r.status === filterStatus)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r =>
        r.customer.fullName?.toLowerCase().includes(q) ||
        r.customer.email?.toLowerCase().includes(q)
      )
    }
    return list
  }, [reservations, serviceResourceIds, filterStatus, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { queueMicrotask(() => setPage(1)) }, [search, filterStatus])

  async function doAction(id: string, action: 'confirm' | 'cancel' | 'complete') {
    setActionLoading(`${id}-${action}`)
    try {
      await reservationsApi[action](id)
      const labels = { confirm: 'Turno confirmado', cancel: 'Turno cancelado', complete: 'Turno completado' }
      toast(labels[action], 'success')
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const selectedService = services.find(s => s.id === form.serviceId)
  // bookingMode del servicio elegido — un servicio no-alojamiento también
  // puede ser "block" (ej. alquiler de un equipo por varios días), por eso
  // se mantiene la rama completa acá, no solo slot/libre.
  const isBlockBooking = selectedService?.bookingMode === 'block'
  const isSlotService = selectedService?.bookingMode === 'slot'
  const nightsCount = isBlockBooking && form.checkIn && form.checkOut
    ? Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86_400_000)
    : null

  useEffect(() => {
    queueMicrotask(() => {
      if (!isSlotService || !form.resourceId || !slotDate) {
        setAvailableSlots(null)
        return
      }
      setLoadingSlots(true)
      bookableServicesApi.getAvailableSlots(form.serviceId, form.resourceId, slotDate)
        .then(res => setAvailableSlots(res.slots))
        .catch(() => setAvailableSlots([]))
        .finally(() => setLoadingSlots(false))
    })
  }, [isSlotService, form.serviceId, form.resourceId, slotDate])

  function selectSlot(startIso: string) {
    if (!selectedService?.durationMinutes) return
    const endIso = new Date(new Date(startIso).getTime() + selectedService.durationMinutes * 60_000).toISOString()
    setForm(f => ({ ...f, startTime: toLocalInput(startIso), endTime: toLocalInput(endIso) }))
  }

  async function handleCreateReservation(e: React.FormEvent) {
    e.preventDefault()
    if (isSlotService && (!form.startTime || !form.endTime)) {
      toast('Elegí un turno disponible', 'error')
      return
    }
    setSubmitting(true)
    setFieldErrors({})
    try {
      const customer = await customersApi.findByEmail(form.customerEmail)
      if (!customer) {
        toast('Cliente no encontrado. Crealo primero en la sección Clientes.', 'error')
        return
      }
      const startTime = isBlockBooking ? new Date(form.checkIn).toISOString() : new Date(form.startTime).toISOString()
      const endTime = isBlockBooking ? new Date(form.checkOut).toISOString() : new Date(form.endTime).toISOString()

      await createReservation({
        resource: 'reservas',
        values: {
          resourceId: form.resourceId,
          customer: { id: customer.id },
          startTime,
          endTime,
          ...(form.serviceId && { serviceId: form.serviceId }),
        },
      })
      toast('Turno creado', 'success')
      setModalOpen(false)
      setForm({ resourceId: '', serviceId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '' })
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function openModal() {
    setForm({ resourceId: '', serviceId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '' })
    setFieldErrors({})
    setSlotDate('')
    setAvailableSlots(null)
    setModalOpen(true)
  }

  const getResourceName = (id: string) =>
    resources.find(r => r.id === id)?.name ?? id.slice(0, 8) + '…'

  const getServiceName = (id?: string | null) =>
    id ? services.find(s => s.id === id)?.name ?? id.slice(0, 8) + '…' : null

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
      const { data: updated } = await updateReservation({
        resource: 'reservas',
        id: detailTarget.id,
        values: {
          startTime: new Date(detailForm.startTime).toISOString(),
          endTime: new Date(detailForm.endTime).toISOString(),
        },
      })
      toast('Turno actualizado', 'success')
      setDetailTarget(updated)
      setEditingDetail(false)
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
      const labels = { confirm: 'Turno confirmado', cancel: 'Turno cancelado', complete: 'Turno completado' }
      const updated = await reservationsApi[action](detailTarget.id)
      toast(labels[action], 'success')
      setDetailTarget(updated)
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className={`bastion`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Turnos</h1>
          <p className="page-subtitle">Reservas de servicios (cortes, mesas, canchas…) — alojamiento está en Reservas</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo turno
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
            <div key={i} className="h-16 rounded-lg skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3>{search || filterStatus ? 'Sin resultados para ese filtro' : 'Sin turnos'}</h3>
          {!search && !filterStatus && <p>Creá el primero con el botón de arriba</p>}
        </div>
      ) : (
        <>
          <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Recurso</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paginated.map(r => (
                  <tr key={r.id} onClick={() => openDetail(r)} style={{ cursor: 'pointer' }}>
                    <td>
                      <p className="table-cell-primary">{r.customer.fullName}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.customer.email}</p>
                    </td>
                    <td>{getResourceName(r.resourceId)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmt(r.startTime)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmt(r.endTime)}</td>
                    <td className="mono">{fmtMoney(r.totalPrice)}</td>
                    <td>
                      <span className={STATUS_BADGE_CLASS[r.status]}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {r.allowedTransitions?.includes('CONFIRMED') && (
                          <button
                            onClick={() => doAction(r.id, 'confirm')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-sage"
                          >
                            {actionLoading === `${r.id}-confirm` ? '…' : 'Confirmar'}
                          </button>
                        )}
                        {r.allowedTransitions?.includes('CANCELLED') && (
                          <button
                            onClick={() => doAction(r.id, 'cancel')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-clay"
                          >
                            {actionLoading === `${r.id}-cancel` ? '…' : 'Cancelar'}
                          </button>
                        )}
                        {r.allowedTransitions?.includes('COMPLETED') && (
                          <button
                            onClick={() => doAction(r.id, 'complete')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-neutral"
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

      {/* Modal nuevo turno — usa <Modal> base */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo turno"
      >
        <form onSubmit={handleCreateReservation} className="p-6 space-y-4">
          <div>
            <label className="label">Servicio (opcional)</label>
            <select
              className="input"
              value={form.serviceId}
              onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}
            >
              <option value="">Sin servicio — horario libre</option>
              {serviceServices.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Recurso</label>
            <select
              className="input"
              value={form.resourceId}
              onChange={e => setForm(f => ({ ...f, resourceId: e.target.value }))}
              required
            >
              <option value="">Seleccioná un recurso…</option>
              {resources
                .filter(r => serviceResourceIds.has(r.id))
                .filter(r => !selectedService || r.categoryId === selectedService.categoryId)
                .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {fieldErrors['resourceId'] && (
              <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['resourceId']}</p>
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
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>El cliente debe estar registrado en el sistema.</p>
          </div>
          {isBlockBooking ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Desde</label>
                <input
                  type="date"
                  className="input"
                  value={form.checkIn}
                  onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">Hasta</label>
                <input
                  type="date"
                  className="input"
                  value={form.checkOut}
                  onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))}
                  required
                />
              </div>
              {nightsCount != null && (
                <p className="col-span-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {nightsCount > 0 ? `${nightsCount} día${nightsCount === 1 ? '' : 's'}` : 'El final debe ser posterior al inicio'}
                </p>
              )}
            </div>
          ) : isSlotService ? (
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                className="input"
                value={slotDate}
                onChange={e => {
                  setSlotDate(e.target.value)
                  setForm(f => ({ ...f, startTime: '', endTime: '' }))
                }}
                required
              />
              {!form.resourceId && (
                <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>Elegí un recurso para ver los turnos disponibles.</p>
              )}
              {form.resourceId && slotDate && (
                loadingSlots ? (
                  <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>Buscando turnos…</p>
                ) : availableSlots && availableSlots.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableSlots.map(slot => {
                      const active = form.startTime === toLocalInput(slot)
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => selectSlot(slot)}
                          className="mono"
                          style={{
                            fontSize: 12, padding: '6px 12px', borderRadius: 8,
                            transition: 'background-color 150ms, color 150ms',
                            background: active ? 'var(--accent)' : 'var(--surface-4)',
                            color: active ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                          }}
                        >
                          {new Date(slot).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </button>
                      )
                    })}
                  </div>
                ) : availableSlots && availableSlots.length === 0 ? (
                  <div className="mt-2 space-y-3">
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      Sin horario configurado para este recurso — elegí el horario manualmente.
                    </p>
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
                  </div>
                ) : null
              )}
            </div>
          ) : (
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
          )}
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
              Crear turno
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal detalle / edición */}
      {detailTarget && (
        <Modal
          open={detailTarget !== null}
          onClose={() => setDetailTarget(null)}
          title={editingDetail ? 'Editar turno' : 'Detalle de turno'}
        >
          {editingDetail ? (
            <form onSubmit={handleUpdateDetail} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Inicio</label>
                  <input
                    type="datetime-local"
                    className="input"
                    style={detailFieldErrors['startTime'] ? { borderColor: 'var(--danger)' } : undefined}
                    value={detailForm.startTime}
                    onChange={e => setDetailForm(f => ({ ...f, startTime: e.target.value }))}
                    required
                  />
                  {detailFieldErrors['startTime'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{detailFieldErrors['startTime']}</p>}
                </div>
                <div>
                  <label className="label">Fin</label>
                  <input
                    type="datetime-local"
                    className="input"
                    style={detailFieldErrors['endTime'] ? { borderColor: 'var(--danger)' } : undefined}
                    value={detailForm.endTime}
                    onChange={e => setDetailForm(f => ({ ...f, endTime: e.target.value }))}
                    required
                  />
                  {detailFieldErrors['endTime'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{detailFieldErrors['endTime']}</p>}
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Cliente, recurso y servicio no se pueden cambiar acá — cancelá este turno y creá uno nuevo si hace falta.
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
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Cliente</p>
                  <p className="table-cell-primary" style={{ fontSize: 14 }}>{detailTarget.customer.fullName}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{detailTarget.customer.email}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Estado</p>
                  <span className={STATUS_BADGE_CLASS[detailTarget.status]}>
                    {STATUS_LABEL[detailTarget.status]}
                  </span>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Recurso</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getResourceName(detailTarget.resourceId)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Servicio</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getServiceName(detailTarget.serviceId) ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Inicio</p>
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>{fmt(detailTarget.startTime)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Fin</p>
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>{fmt(detailTarget.endTime)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Precio</p>
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>{fmtMoney(detailTarget.totalPrice)}</p>
                </div>
                {detailTarget.partySize != null && detailTarget.partySize > 1 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Personas</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{detailTarget.partySize}</p>
                  </div>
                )}
              </div>

              {detailTarget.notes && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Notas</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{detailTarget.notes}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                {detailTarget.status === 'PENDING' && (
                  <button
                    onClick={() => setEditingDetail(true)}
                    className="btn-mini btn-mini-neutral"
                  >
                    Editar horario
                  </button>
                )}
                {detailTarget.allowedTransitions?.includes('CONFIRMED') && (
                  <button
                    onClick={() => doDetailAction('confirm')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-sage"
                  >
                    Confirmar
                  </button>
                )}
                {detailTarget.allowedTransitions?.includes('CANCELLED') && (
                  <button
                    onClick={() => doDetailAction('cancel')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-clay"
                  >
                    Cancelar turno
                  </button>
                )}
                {detailTarget.allowedTransitions?.includes('COMPLETED') && (
                  <button
                    onClick={() => doDetailAction('complete')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-neutral"
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
