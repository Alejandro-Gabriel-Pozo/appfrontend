'use client'
import { useState, useEffect, useMemo } from 'react'
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { useTable, useCreate, useUpdate, useInvalidate } from '@refinedev/core'
import { reservationsApi, resourcesApi, customersApi, bookableServicesApi, categoriesApi, ratePlansApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import RoomCalendar from '@/components/RoomCalendar'
import type { Reservation, Resource, ReservationStatus, BookableService, Category, RatePlan } from '@/lib/types'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Primera pantalla migrada (18/08/2026) — módulo PMS, acento brass. El scope
// vive en la clase .bastion (globals.css); acá solo se cargan las 3
// tipografías vía next/font (auto-hosted, sin <link> manual) y se exponen
// como variables CSS que consume ese scope.
const fraunces = Fraunces({ subsets: ['latin'], weight: ['300', '500', '600'], variable: '--font-bastion-serif' })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-bastion-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-bastion-mono' })

const PAGE_SIZE = 20

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
}

// Semáforo Bastión (sección 5 del doc): pending=brass, confirmed=sage,
// completed=gris neutro, cancelled=clay — badge-* ya vive en globals.css
// y toma esa paleta automáticamente dentro del scope .bastion.
const STATUS_BADGE_CLASS: Record<ReservationStatus, string> = {
  PENDING: 'badge-pending',
  CONFIRMED: 'badge-confirmed',
  CANCELLED: 'badge-cancelled',
  COMPLETED: 'badge-completed',
}

const ALL_STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED']

// Flujo de horario de check-in/check-out fuera del estándar (18/08/2026,
// pendientes-2026-08-18.md punto N).
const SCHEDULE_STATUS_LABEL: Record<'PENDING' | 'APPROVED' | 'REJECTED', string> = {
  PENDING: 'Pendiente de aprobación',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
}
const SCHEDULE_STATUS_BADGE_CLASS: Record<'PENDING' | 'APPROVED' | 'REJECTED', string> = {
  PENDING: 'badge-pending',
  APPROVED: 'badge-confirmed',
  REJECTED: 'badge-cancelled',
}

// Reservas es 100% alojamiento (E1, 18/08/2026) — toda reserva acá es por
// noche/día calendario, nunca por hora exacta. Se muestra y edita en UTC,
// nunca en hora local: una reserva creada como "check-in 21/8" se guarda
// como 2026-08-21T00:00:00.000Z (mismo criterio que el form de creación,
// new Date('YYYY-MM-DD').toISOString()) — formatearla con getters LOCALES
// la corre un día para atrás en cualquier huso detrás de UTC (Argentina:
// medianoche UTC del 21 = 21:00 del 20 en hora local). Mismo motivo que el
// fix del bug de housekeeping.
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'short', timeZone: 'UTC' })
}

/** input type="date" necesita "YYYY-MM-DD" en UTC, no en hora local. */
function toUTCDateInput(iso: string) {
  return iso.slice(0, 10)
}

const fmtMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format

export default function ReservasPage() {
  const { toast } = useToast()
  // Sin paginación server-side todavía (ver lib/refine/dataProvider.ts) —
  // pagination: { mode: 'off' } trae la lista completa; el filtrado/paginado
  // sigue siendo 100% client-side, igual que antes de migrar.
  const { result, tableQuery } = useTable<Reservation>({ resource: 'reservas', pagination: { mode: 'off' } })
  const reservations = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createReservation } = useCreate<Reservation>()
  const { mutateAsync: updateReservation } = useUpdate<Reservation>()
  // confirm/cancel/complete son acciones con nombre (reservationsApi[action])
  // que no pasan por el data provider — invalidate() fuerza el refetch de
  // la lista después, igual que create/update lo hacen solos vía Refine.
  const invalidate = useInvalidate()

  const [resources, setResources] = useState<Resource[]>([])
  const [services, setServices] = useState<BookableService[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filtros y paginación
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ReservationStatus | ''>('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'calendar'>('list')

  // Modal nueva reserva
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ resourceId: '', serviceId: '', ratePlanId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '', adultos: 1, ninos: 0 })
  // Tarifas del servicio elegido (spec de mejoras PMS, 18/08/2026) —
  // selector de DOS pasos: elegir servicio primero, después (si tiene
  // tarifas) elegir cuál. Sin tarifas cargadas, el servicio sigue usando
  // su precio de catálogo como siempre.
  const [serviceRatePlans, setServiceRatePlans] = useState<RatePlan[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Turnos disponibles (servicios "slot" con horario configurado — Mi Negocio / recurso)
  const [slotDate, setSlotDate] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Modal detalle / edición
  const [detailTarget, setDetailTarget] = useState<Reservation | null>(null)
  const [editingDetail, setEditingDetail] = useState(false)
  const [detailForm, setDetailForm] = useState({ startTime: '', endTime: '', adultos: 1, ninos: 0 })
  const [detailFieldErrors, setDetailFieldErrors] = useState<Record<string, string>>({})
  const [detailSubmitting, setDetailSubmitting] = useState(false)

  // Horario especial (early check-in / late check-out) — pendientes-2026-08-18.md punto N.
  const [scheduleRequestOpen, setScheduleRequestOpen] = useState(false)
  const [scheduleRequestForm, setScheduleRequestForm] = useState({ requestedCheckInTime: '', requestedCheckOutTime: '' })
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)
  const [scheduleApproveOpen, setScheduleApproveOpen] = useState(false)
  const [scheduleChargeAmount, setScheduleChargeAmount] = useState('')

  // Recursos/servicios no están migrados a esta pantalla — se siguen
  // trayendo directo, igual que antes.
  useEffect(() => {
    queueMicrotask(() => {
      Promise.all([resourcesApi.list(), bookableServicesApi.list(), categoriesApi.list()])
        .then(([recs, svcs, cats]) => { setResources(recs); setServices(svcs); setCategories(cats) })
        .catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

  // Backlog E1 (13/08/2026, alcance completo 18/08) — Reservas queda
  // acotada a alojamiento (categorías con isLodging=true), Turnos maneja
  // todo lo demás. lodgingResourceIds resuelve recurso → categoría →
  // isLodging una sola vez por render, no en cada .filter().
  const lodgingCategoryIds = useMemo(
    () => new Set(categories.filter(c => c.isLodging).map(c => c.id)),
    [categories],
  )
  const lodgingResources = useMemo(
    () => resources.filter(r => lodgingCategoryIds.has(r.categoryId)),
    [resources, lodgingCategoryIds],
  )
  const lodgingResourceIds = useMemo(
    () => new Set(lodgingResources.map(r => r.id)),
    [lodgingResources],
  )
  const lodgingServices = useMemo(
    () => services.filter(s => lodgingCategoryIds.has(s.categoryId)),
    [services, lodgingCategoryIds],
  )

  // Filtrado y paginación en cliente
  const filtered = useMemo(() => {
    let list = reservations.filter(r => lodgingResourceIds.has(r.resourceId))
    if (filterStatus) list = list.filter(r => r.status === filterStatus)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r =>
        r.customer.fullName?.toLowerCase().includes(q) ||
        r.customer.email?.toLowerCase().includes(q)
      )
    }
    return list
  }, [reservations, lodgingResourceIds, filterStatus, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Resetear página al cambiar filtros
  useEffect(() => { queueMicrotask(() => setPage(1)) }, [search, filterStatus])

  async function doAction(id: string, action: 'confirm' | 'cancel' | 'complete') {
    setActionLoading(`${id}-${action}`)
    try {
      await reservationsApi[action](id)
      const labels = { confirm: 'Reserva confirmada', cancel: 'Reserva cancelada', complete: 'Reserva completada' }
      toast(labels[action], 'success')
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const selectedService = services.find(s => s.id === form.serviceId)
  const isSlotService = selectedService?.bookingMode === 'slot'

  // Selector de dos pasos (spec de mejoras PMS, 18/08/2026): al elegir un
  // servicio, se traen sus tarifas. Sin tarifas cargadas para ese servicio,
  // el segundo paso simplemente no aparece y la reserva sigue usando el
  // precio de catálogo del servicio, como siempre.
  useEffect(() => {
    // form.serviceId === '' no dispara fetch -- el guard de renderizado
    // (`form.serviceId && serviceRatePlans.length > 0`) ya evita mostrar
    // tarifas de un servicio previo mientras no hay ninguno elegido.
    if (!form.serviceId) return
    let cancelled = false
    ratePlansApi.list(form.serviceId)
      .then(plans => { if (!cancelled) setServiceRatePlans(plans) })
      .catch(err => { if (!cancelled) toast(extractErrorMessage(err), 'error') })
    return () => { cancelled = true }
  }, [form.serviceId, toast])
  // Reservas es 100% alojamiento (E1) — check-in/check-out por día
  // calendario es el caso por defecto, se elija o no un "servicio"
  // puntual. El único caso que necesita hora exacta es un servicio con
  // bookingMode "slot" (turno con horario configurado sobre un recurso de
  // alojamiento — ej. una actividad guiada), caso raro, gestionado aparte.
  const useDateOnlyFields = !isSlotService
  const nightsCount = useDateOnlyFields && form.checkIn && form.checkOut
    ? Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86_400_000)
    : null

  // Turnos disponibles: solo aplica a servicios "slot" con recurso + fecha
  // elegidos. Si no hay horario configurado (ni del recurso ni del negocio),
  // el endpoint devuelve [] y se cae al datetime-local libre (ver JSX abajo)
  // — el staff siempre puede overridear si hace falta.
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
      // Alojamiento: se reserva por fecha, no por hora — el check-in/
      // check-out se manda como medianoche UTC de esa fecha, que es como
      // el backend calcula las noches (por día calendario).
      const startTime = useDateOnlyFields ? new Date(form.checkIn).toISOString() : new Date(form.startTime).toISOString()
      const endTime = useDateOnlyFields ? new Date(form.checkOut).toISOString() : new Date(form.endTime).toISOString()

      await createReservation({
        resource: 'reservas',
        values: {
          resourceId: form.resourceId,
          customer: { id: customer.id },
          startTime,
          endTime,
          ...(form.serviceId && { serviceId: form.serviceId }),
          ...(form.ratePlanId && { ratePlanId: form.ratePlanId }),
          adultos: form.adultos,
          ...(form.ninos > 0 && { ninos: form.ninos }),
        },
      })
      toast('Reserva creada', 'success')
      setModalOpen(false)
      setForm({ resourceId: '', serviceId: '', ratePlanId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '', adultos: 1, ninos: 0 })
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function openModal() {
    setForm({ resourceId: '', serviceId: '', ratePlanId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '', adultos: 1, ninos: 0 })
    setFieldErrors({})
    setSlotDate('')
    setAvailableSlots(null)
    setModalOpen(true)
  }

  /** Click en una celda vacía del calendario — abre "Nueva reserva" con
   * habitación y fecha precargadas (check-in = el día clickeado, check-out
   * = al día siguiente, 1 noche por defecto). Sin servicio elegido, el
   * form muestra la rama de check-in/check-out por fecha (el default de
   * esta pantalla, ver useDateOnlyFields más abajo). */
  function openModalForSlot(resourceId: string, date: Date) {
    const dateStr = toUTCDateInput(date.toISOString())
    const nextDateStr = toUTCDateInput(new Date(date.getTime() + 86_400_000).toISOString())
    setForm({
      resourceId, serviceId: '', ratePlanId: '', customerEmail: '',
      checkIn: dateStr, checkOut: nextDateStr,
      startTime: '', endTime: '',
      adultos: 1, ninos: 0,
    })
    setFieldErrors({})
    setSlotDate('')
    setAvailableSlots(null)
    setModalOpen(true)
  }

  /** Drag-to-move/resize del calendario — llama al mismo PUT que "Editar
   * horario" ya usa. Si falla (ej. 409 por conflicto contra el destino), no
   * hace falta revertir nada a mano: el calendario nunca mutó su propia
   * lista, solo mostraba un ghost temporal que ya desapareció al soltar. */
  async function handleCalendarUpdate(id: string, changes: { startTime?: string; endTime?: string; resourceId?: string }) {
    try {
      await updateReservation({ resource: 'reservas', id, values: changes })
      toast('Reserva actualizada', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
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
    // Fechas por día calendario UTC, no datetime-local — ver useDateOnlyFields.
    setDetailForm({
      startTime: toUTCDateInput(r.startTime), endTime: toUTCDateInput(r.endTime),
      adultos: r.adultos ?? 1, ninos: r.ninos ?? 0,
    })
    setDetailFieldErrors({})
    setScheduleRequestOpen(false)
    setScheduleApproveOpen(false)
    setScheduleRequestForm({
      requestedCheckInTime: r.requestedCheckInTime?.slice(0, 5) ?? '',
      requestedCheckOutTime: r.requestedCheckOutTime?.slice(0, 5) ?? '',
    })
    setScheduleChargeAmount('')
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
          adultos: detailForm.adultos,
          ninos: detailForm.ninos,
        },
      })
      toast('Reserva actualizada', 'success')
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
      const labels = { confirm: 'Reserva confirmada', cancel: 'Reserva cancelada', complete: 'Reserva completada' }
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

  async function submitScheduleRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!detailTarget) return
    const { requestedCheckInTime, requestedCheckOutTime } = scheduleRequestForm
    if (!requestedCheckInTime && !requestedCheckOutTime) {
      toast('Pedí una hora de check-in o de check-out', 'error')
      return
    }
    setScheduleSubmitting(true)
    try {
      const updated = await reservationsApi.requestScheduleChange(detailTarget.id, {
        ...(requestedCheckInTime && { requestedCheckInTime }),
        ...(requestedCheckOutTime && { requestedCheckOutTime }),
      })
      toast('Horario especial pedido — queda pendiente de aprobación', 'success')
      setDetailTarget(updated)
      setScheduleRequestOpen(false)
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setScheduleSubmitting(false)
    }
  }

  async function approveSchedule() {
    if (!detailTarget) return
    setActionLoading(`${detailTarget.id}-approve-schedule`)
    try {
      const amount = scheduleChargeAmount.trim() === '' ? undefined : parseFloat(scheduleChargeAmount)
      const updated = await reservationsApi.approveScheduleChange(detailTarget.id, { chargeAmount: amount })
      toast('Horario especial aprobado', 'success')
      setDetailTarget(updated)
      setScheduleApproveOpen(false)
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      // NEXT_ARRIVAL_CONFLICT (409) llega acá con un mensaje ya en
      // castellano ("Conflicto: próxima llegada a las HH:MM") — no hace
      // falta traducirlo de nuevo, se muestra tal cual.
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function rejectSchedule() {
    if (!detailTarget) return
    setActionLoading(`${detailTarget.id}-reject-schedule`)
    try {
      const updated = await reservationsApi.rejectScheduleChange(detailTarget.id)
      toast('Horario especial rechazado', 'success')
      setDetailTarget(updated)
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className={`bastion ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Reservas</h1>
          <p className="page-subtitle">Reservas de alojamiento (habitaciones, cabañas…) — servicios puntuales están en Turnos</p>
        </div>
        <button onClick={openModal} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva reserva
        </button>
      </div>

      {/* Tabs de vista */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setView('list')} className={view === 'list' ? 'btn-mini btn-mini-neutral' : 'btn-secondary'} style={{ padding: '7px 14px' }}>
          Lista
        </button>
        <button onClick={() => setView('calendar')} className={view === 'calendar' ? 'btn-mini btn-mini-neutral' : 'btn-secondary'} style={{ padding: '7px 14px' }}>
          Calendario
        </button>
      </div>

      {view === 'calendar' ? (
        <RoomCalendar
          resources={lodgingResources}
          reservations={filtered}
          services={services}
          onReservationClick={openDetail}
          onEmptySlotClick={openModalForSlot}
          onUpdated={handleCalendarUpdate}
        />
      ) : (
        <>
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
          <h3>{search || filterStatus ? 'Sin resultados para ese filtro' : 'Sin reservas'}</h3>
          {!search && !filterStatus && (
            lodgingCategoryIds.size === 0 ? (
              <p>No hay ninguna categoría marcada como alojamiento todavía — marcá una en Categorías para poder reservar acá.</p>
            ) : (
              <p>Creá la primera con el botón de arriba</p>
            )
          )}
        </div>
      ) : (
        <>
          <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Recurso</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
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
            <label className="label">Servicio (opcional)</label>
            <select
              className="input"
              value={form.serviceId}
              onChange={e => setForm(f => ({ ...f, serviceId: e.target.value, ratePlanId: '' }))}
            >
              <option value="">Sin servicio — horario libre</option>
              {lodgingServices.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.bookingMode === 'block' ? ' (alojamiento — por noche)' : ''}
                </option>
              ))}
            </select>
          </div>
          {form.serviceId && serviceRatePlans.length > 0 && (
            <div>
              <label className="label">Tarifa (opcional)</label>
              <select
                className="input"
                value={form.ratePlanId}
                onChange={e => setForm(f => ({ ...f, ratePlanId: e.target.value }))}
              >
                <option value="">Precio de catálogo (${selectedService?.price.toLocaleString('es-AR')})</option>
                {serviceRatePlans.map(rp => (
                  <option key={rp.id} value={rp.id}>{rp.name} — ${rp.price.toLocaleString('es-AR')}</option>
                ))}
              </select>
            </div>
          )}
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
                .filter(r => lodgingResourceIds.has(r.id))
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
          {isSlotService ? (
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
                <label className="label">Check-in</label>
                <input
                  type="date"
                  className="input"
                  value={form.checkIn}
                  onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">Check-out</label>
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
                  {nightsCount > 0 ? `${nightsCount} noche${nightsCount === 1 ? '' : 's'}` : 'El check-out debe ser posterior al check-in'}
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Adultos</label>
              <input
                type="number"
                className="input"
                min={1}
                value={form.adultos}
                onChange={e => setForm(f => ({ ...f, adultos: e.target.value === '' ? 1 : parseInt(e.target.value, 10) }))}
                required
              />
            </div>
            <div>
              <label className="label">Niños</label>
              <input
                type="number"
                className="input"
                min={0}
                value={form.ninos}
                onChange={e => setForm(f => ({ ...f, ninos: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
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
                  <label className="label">Check-in</label>
                  <input
                    type="date"
                    className="input"
                    style={detailFieldErrors['startTime'] ? { borderColor: 'var(--danger)' } : undefined}
                    value={detailForm.startTime}
                    onChange={e => setDetailForm(f => ({ ...f, startTime: e.target.value }))}
                    required
                  />
                  {detailFieldErrors['startTime'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{detailFieldErrors['startTime']}</p>}
                </div>
                <div>
                  <label className="label">Check-out</label>
                  <input
                    type="date"
                    className="input"
                    style={detailFieldErrors['endTime'] ? { borderColor: 'var(--danger)' } : undefined}
                    value={detailForm.endTime}
                    onChange={e => setDetailForm(f => ({ ...f, endTime: e.target.value }))}
                    required
                  />
                  {detailFieldErrors['endTime'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{detailFieldErrors['endTime']}</p>}
                </div>
                <div>
                  <label className="label">Adultos</label>
                  <input
                    type="number"
                    className="input"
                    min={1}
                    style={detailFieldErrors['adultos'] ? { borderColor: 'var(--danger)' } : undefined}
                    value={detailForm.adultos}
                    onChange={e => setDetailForm(f => ({ ...f, adultos: e.target.value === '' ? 1 : parseInt(e.target.value, 10) }))}
                    required
                  />
                  {detailFieldErrors['adultos'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{detailFieldErrors['adultos']}</p>}
                </div>
                <div>
                  <label className="label">Niños</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    style={detailFieldErrors['ninos'] ? { borderColor: 'var(--danger)' } : undefined}
                    value={detailForm.ninos}
                    onChange={e => setDetailForm(f => ({ ...f, ninos: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
                  />
                  {detailFieldErrors['ninos'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{detailFieldErrors['ninos']}</p>}
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
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
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Check-in</p>
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>{fmt(detailTarget.startTime)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Check-out</p>
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
                {detailTarget.adultos != null && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Huéspedes</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Adultos: {detailTarget.adultos} · Niños: {detailTarget.ninos ?? 0}
                    </p>
                  </div>
                )}
              </div>

              {detailTarget.notes && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Notas</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{detailTarget.notes}</p>
                </div>
              )}

              {/* Horario especial (early check-in / late check-out) — pendientes-2026-08-18.md punto N. */}
              {detailTarget.scheduleApprovalStatus && (
                <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Horario especial pedido</p>
                    <span className={SCHEDULE_STATUS_BADGE_CLASS[detailTarget.scheduleApprovalStatus]}>
                      {SCHEDULE_STATUS_LABEL[detailTarget.scheduleApprovalStatus]}
                    </span>
                  </div>
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>
                    {detailTarget.requestedCheckInTime && `Check-in: ${detailTarget.requestedCheckInTime.slice(0, 5)}`}
                    {detailTarget.requestedCheckInTime && detailTarget.requestedCheckOutTime && '  ·  '}
                    {detailTarget.requestedCheckOutTime && `Check-out: ${detailTarget.requestedCheckOutTime.slice(0, 5)}`}
                  </p>
                  {detailTarget.scheduleApprovalStatus === 'APPROVED' && !!detailTarget.scheduleChargeAmount && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      Cargo aplicado: {fmtMoney(detailTarget.scheduleChargeAmount)}
                    </p>
                  )}
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
                {(detailTarget.status === 'PENDING' || detailTarget.status === 'CONFIRMED') && (
                  <button
                    onClick={() => setScheduleRequestOpen(o => !o)}
                    className="btn-mini btn-mini-neutral"
                  >
                    {detailTarget.scheduleApprovalStatus ? 'Volver a pedir horario' : 'Pedir horario especial'}
                  </button>
                )}
                {detailTarget.scheduleApprovalStatus === 'PENDING' && (
                  <>
                    <button
                      onClick={() => setScheduleApproveOpen(o => !o)}
                      disabled={actionLoading !== null}
                      className="btn-mini btn-mini-sage"
                    >
                      Aprobar horario
                    </button>
                    <button
                      onClick={rejectSchedule}
                      disabled={actionLoading !== null}
                      className="btn-mini btn-mini-clay"
                    >
                      {actionLoading === `${detailTarget.id}-reject-schedule` ? '…' : 'Rechazar horario'}
                    </button>
                  </>
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
                    Cancelar reserva
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

              {scheduleRequestOpen && (
                <form onSubmit={submitScheduleRequest} className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Dejá el campo vacío para no pedir cambio en ese horario. El estándar del negocio se configura en Mi Negocio.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Check-in pedido</label>
                      <input
                        type="time" className="input"
                        value={scheduleRequestForm.requestedCheckInTime}
                        onChange={e => setScheduleRequestForm(f => ({ ...f, requestedCheckInTime: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Check-out pedido</label>
                      <input
                        type="time" className="input"
                        value={scheduleRequestForm.requestedCheckOutTime}
                        onChange={e => setScheduleRequestForm(f => ({ ...f, requestedCheckOutTime: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setScheduleRequestOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                    <button type="submit" disabled={scheduleSubmitting} className="btn-primary flex-1">
                      {scheduleSubmitting ? <span className="spinner" /> : null}
                      Enviar pedido
                    </button>
                  </div>
                </form>
              )}

              {scheduleApproveOpen && (
                <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div>
                    <label className="label">Cargo por el horario especial (opcional)</label>
                    <input
                      type="number" className="input" min={0} step="0.01"
                      value={scheduleChargeAmount}
                      onChange={e => setScheduleChargeAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setScheduleApproveOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                    <button
                      type="button" onClick={approveSchedule}
                      disabled={actionLoading !== null}
                      className="btn-primary flex-1"
                    >
                      {actionLoading === `${detailTarget.id}-approve-schedule` ? <span className="spinner" /> : null}
                      Confirmar aprobación
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
