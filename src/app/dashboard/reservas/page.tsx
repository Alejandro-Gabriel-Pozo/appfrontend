'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { customersApi, ratePlansApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import SignalBadge from '@/components/SignalBadge'
import RoomCalendar, { todayUTCMidnightMs, VISIBLE_DAYS, MS_PER_DAY } from '@/components/RoomCalendar'
import { useReservationsScreen, useAvailableSlots, toLocalInput } from '@/hooks/useReservationsScreen'
import { useNumeroOperativo, SIN_NUMERO } from '@/lib/business-context/numero-operativo'
import type { ReservationStatus, RatePlan } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Primera pantalla migrada a Bastión (18/08/2026), ahora en ZULU. El scope
// vive en la clase .zulu (globals.css).

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
  EXPIRED: 'Vencida',
}

// Semáforo de estado: pending=warning, confirmed=info, completed=success,
// cancelled=danger, expired=neutro (distinto de cancelled a propósito,
// RESERVATION-STATUS-EXPIRED-FRONTEND-01) — badge-* ya vive en globals.css
// y toma esa paleta automáticamente dentro del scope .zulu.
const STATUS_BADGE_CLASS: Record<ReservationStatus, string> = {
  PENDING: 'badge-pending',
  CONFIRMED: 'badge-confirmed',
  CANCELLED: 'badge-cancelled',
  COMPLETED: 'badge-completed',
  EXPIRED: 'badge-expired',
}

const ALL_STATUSES: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED']

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
  const router = useRouter()
  const [view, setView] = useState<'list' | 'calendar'>('list')
  // K2 (23/08/2026) — acota el 'off' del calendario a la semana visible; sin
  // esto traería TODO el historial de alojamiento sin límite (mismo
  // problema estructural que K2 resolvió para la lista, en miniatura).
  // Arranca en la semana de "hoy" — mismo default que RoomCalendar usa
  // internamente (`todayUTCMidnightMs`) — así el primer fetch, antes de
  // que el calendario llegue a montarse y avisar su semana real, ya viene
  // acotado, no sin límite.
  const [calendarRange, setCalendarRange] = useState(() => {
    const start = todayUTCMidnightMs()
    return { from: new Date(start).toISOString(), to: new Date(start + VISIBLE_DAYS * MS_PER_DAY).toISOString() }
  })
  const handleWeekChange = useCallback((startMs: number, endMs: number) => {
    setCalendarRange({ from: new Date(startMs).toISOString(), to: new Date(endMs).toISOString() })
  }, [])

  // Motor compartido con Turnos (Fase 4, auditoria-modularidad.md F4) —
  // trae recursos/servicios/categorías, filtra por isLodging, lista/busca/
  // pagina reservas, y las acciones de confirmar/cancelar/completar.
  // K2 (23/08/2026) — la vista de calendario necesita TODAS las reservas
  // de la semana visible, no una página de 20 (RoomCalendar dibuja un
  // rango de fechas completo) — por eso el modo de paginación depende de
  // `view`, no queda fijo en 'server', y solo en calendario se manda
  // `calendarRange`.
  const {
    loading,
    createReservation, updateReservation,
    resources, services,
    screenCategoryIds: lodgingCategoryIds,
    screenResources: lodgingResources,
    screenResourceIds: lodgingResourceIds,
    screenServices: lodgingServices,
    search, setSearch, filterStatus, setFilterStatus,
    page, setPage, totalPages, paginated, filtered, total,
    actionLoading, doAction: doScreenAction,
    getResourceName,
  } = useReservationsScreen(true, view === 'calendar' ? 'off' : 'server', view === 'calendar' ? calendarRange : undefined)

  const { cargando: cargandoNumero, formatearReserva } = useNumeroOperativo()

  // Modal nueva reserva
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ resourceId: '', serviceId: '', ratePlanId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '', adultos: 1, ninos: 0, anyResource: false })
  // Tarifas del servicio elegido (spec de mejoras PMS, 18/08/2026) —
  // selector de DOS pasos: elegir servicio primero, después (si tiene
  // tarifas) elegir cuál. Sin tarifas cargadas, el servicio sigue usando
  // su precio de catálogo como siempre.
  const [serviceRatePlans, setServiceRatePlans] = useState<RatePlan[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Turnos disponibles (servicios "slot" con horario configurado — Mi Negocio / recurso)
  const [slotDate, setSlotDate] = useState('')

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
  const { availableSlots, setAvailableSlots, loadingSlots } = useAvailableSlots(isSlotService, form.serviceId, form.resourceId, slotDate)

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
          // K4 — con "cualquier recurso disponible" tildado, se manda
          // categoryId (del servicio elegido) en vez de resourceId; son
          // mutuamente excluyentes del lado del backend (CreateReservationSchema).
          ...(form.anyResource && selectedService
            ? { categoryId: selectedService.categoryId }
            : { resourceId: form.resourceId }),
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
      setForm({ resourceId: '', serviceId: '', ratePlanId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '', adultos: 1, ninos: 0, anyResource: false })
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function openModal() {
    setForm({ resourceId: '', serviceId: '', ratePlanId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '', adultos: 1, ninos: 0, anyResource: false })
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
      adultos: 1, ninos: 0, anyResource: false,
    })
    setFieldErrors({})
    setSlotDate('')
    setAvailableSlots(null)
    setModalOpen(true)
  }

  /** Drag-to-move/resize del calendario — llama al mismo PUT que la ruta de
   * detalle usa. Si falla (ej. 409 por conflicto contra el destino), no
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

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
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
          onReservationClick={r => router.push(`/dashboard/reservas/${r.id}`)}
          onEmptySlotClick={openModalForSlot}
          onUpdated={handleCalendarUpdate}
          onWeekChange={handleWeekChange}
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
                  <th>N.º</th>
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
                  <tr key={r.id} onClick={() => router.push(`/dashboard/reservas/${r.id}`)} style={{ cursor: 'pointer' }}>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {cargandoNumero
                        ? <span className="skeleton" style={{ display: 'inline-block', width: 76, height: 12 }} />
                        : (formatearReserva(r.reservationNumber) ?? SIN_NUMERO)}
                    </td>
                    <td>
                      <p className="table-cell-primary">{r.customer.fullName}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.customer.email}</p>
                    </td>
                    <td>{getResourceName(r.resourceId)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmt(r.startTime)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{fmt(r.endTime)}</td>
                    <td className="mono">{fmtMoney(r.totalPrice)}</td>
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={STATUS_BADGE_CLASS[r.status]}>
                          {STATUS_LABEL[r.status]}
                        </span>
                        {/* v11/Fase 1 (25/09/2026) -- eje independiente de status,
                            ver el docblock de AssignmentStatus en lib/reservas/types.ts.
                            El campo puede faltar (portal, o backend anterior a 4.3
                            Fase 1): la comparación estricta da false y no se muestra
                            nada -- no asumir ningún estado fijo de deploy acá. */}
                        {r.assignmentStatus === 'PENDING_ASSIGNMENT' && (
                          <SignalBadge state="unassigned" label="Sin asignar" />
                        )}
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {r.allowedTransitions?.includes('CONFIRMED') && (
                          <button
                            onClick={() => doScreenAction(r.id, 'confirm', 'Reserva')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-confirm"
                          >
                            {actionLoading === `${r.id}-confirm` ? '…' : 'Confirmar'}
                          </button>
                        )}
                        {r.allowedTransitions?.includes('CANCELLED') && (
                          <button
                            onClick={() => doScreenAction(r.id, 'cancel', 'Reserva')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-danger"
                          >
                            {actionLoading === `${r.id}-cancel` ? '…' : 'Cancelar'}
                          </button>
                        )}
                        {r.allowedTransitions?.includes('COMPLETED') && (
                          <button
                            onClick={() => doScreenAction(r.id, 'complete', 'Reserva')}
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
                {total} resultado{total !== 1 ? 's' : ''} · página {page} de {totalPages}
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
            {/* 27/08/2026, docs/diseno-precio-servicio-vs-recurso-2026-08-27.md
                (paso 0.c): esta pantalla es SIEMPRE alojamiento --
                useReservationsScreen(true, ...) más arriba ya filtra
                `lodgingServices` a categorías isLodging -- así que "Sin
                servicio" nunca fue una opción legítima acá, solo un atajo
                que dejaba la reserva sin precio por noche, sin rate plans y
                sin "cualquier recurso disponible" (K4). El backend ya lo
                rechaza (LodgingRequiresServiceError); esto lo evita antes
                del viaje al servidor. */}
            <label className="label">Servicio *</label>
            <select
              className="input"
              required
              value={form.serviceId}
              onChange={e => setForm(f => ({ ...f, serviceId: e.target.value, ratePlanId: '' }))}
            >
              <option value="" disabled>Elegí un servicio</option>
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
            {/* K4 (23/08/2026, pendientes-2026-08-23.md) — el backend ya
                soporta asignación automática (categoryId en vez de
                resourceId, ReservationService.findAvailableResourceInCategory)
                pero no estaba expuesta acá. Solo disponible con un servicio
                elegido: de ahí sale el categoryId. */}
            {form.serviceId && (
              <label className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                <input
                  type="checkbox"
                  checked={form.anyResource}
                  onChange={e => setForm(f => ({ ...f, anyResource: e.target.checked, resourceId: '' }))}
                  style={{ accentColor: 'var(--zulu-form-control)' }}
                />
                Cualquier recurso disponible
              </label>
            )}
            {form.anyResource && form.serviceId ? (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Se asigna automáticamente el primer recurso libre de la categoría del servicio elegido.
              </p>
            ) : (
              <>
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
              </>
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
                            background: active ? 'var(--zulu-module-context)' : 'var(--surface-4)',
                            color: active ? 'var(--zulu-on-context)' : 'var(--text-secondary)',
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
    </div>
  )
}
