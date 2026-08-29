'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { customersApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import { useReservationsScreen, useAvailableSlots, toLocalInput } from '@/hooks/useReservationsScreen'
import type { ReservationStatus } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Backlog E1 (13/08/2026, alcance completo 18/08) — separa el panel de
// servicios puntuales (Turnos) del de alojamiento (Reservas + Estadías).
// Es un clon deliberado de dashboard/reservas/page.tsx con el filtro de
// categoría invertido — mismo módulo core, sin gate, acento brass.

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
  const router = useRouter()
  // Motor compartido con Reservas (Fase 4, auditoria-modularidad.md F4) —
  // trae recursos/servicios/categorías, filtra por isLodging (acá
  // invertido: false), lista/busca/pagina reservas, y las acciones de
  // confirmar/cancelar/completar. Mismo recurso Refine 'reservas' que la
  // pantalla de alojamiento — la separación es 100% de filtrado
  // client-side por categoría, no un recurso de backend distinto (no
  // existe tal cosa: es la misma entidad Reservation para ambos paneles).
  const {
    loading,
    createReservation,
    resources, services,
    screenResourceIds: serviceResourceIds,
    screenServices: serviceServices,
    search, setSearch, filterStatus, setFilterStatus,
    page, setPage, totalPages, paginated, filtered, total,
    actionLoading, doAction: doScreenAction,
    getResourceName,
  } = useReservationsScreen(false)

  // Modal nuevo turno
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ resourceId: '', serviceId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '', anyResource: false })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Turnos disponibles (servicios "slot" con horario configurado — Mi Negocio / recurso)
  const [slotDate, setSlotDate] = useState('')

  const selectedService = services.find(s => s.id === form.serviceId)
  // bookingMode del servicio elegido — un servicio no-alojamiento también
  // puede ser "block" (ej. alquiler de un equipo por varios días), por eso
  // se mantiene la rama completa acá, no solo slot/libre.
  const isBlockBooking = selectedService?.bookingMode === 'block'
  const isSlotService = selectedService?.bookingMode === 'slot'
  // "Sin servicio" y bookingMode 'event' (ej. salón/mesa reservada en
  // exclusiva para un evento) caen acá, en el formulario de fecha/hora a
  // mano de más abajo (el último `else` del JSX) — es una decisión
  // explícita (confirmada con el dueño, 18/08/2026, docs/
  // auditoria-modularidad.md Fase 4): un evento no elige de una grilla de
  // turnos sugeridos, el organizador carga inicio/fin exactos.
  const nightsCount = isBlockBooking && form.checkIn && form.checkOut
    ? Math.round((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86_400_000)
    : null

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
      const startTime = isBlockBooking ? new Date(form.checkIn).toISOString() : new Date(form.startTime).toISOString()
      const endTime = isBlockBooking ? new Date(form.checkOut).toISOString() : new Date(form.endTime).toISOString()

      await createReservation({
        resource: 'reservas',
        values: {
          // K4 — ver comentario equivalente en dashboard/reservas/page.tsx.
          ...(form.anyResource && selectedService
            ? { categoryId: selectedService.categoryId }
            : { resourceId: form.resourceId }),
          customer: { id: customer.id },
          startTime,
          endTime,
          ...(form.serviceId && { serviceId: form.serviceId }),
        },
      })
      toast('Turno creado', 'success')
      setModalOpen(false)
      setForm({ resourceId: '', serviceId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '', anyResource: false })
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function openModal() {
    setForm({ resourceId: '', serviceId: '', customerEmail: '', startTime: '', endTime: '', checkIn: '', checkOut: '', anyResource: false })
    setFieldErrors({})
    setSlotDate('')
    setAvailableSlots(null)
    setModalOpen(true)
  }

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
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
                  <tr key={r.id} onClick={() => router.push(`/dashboard/turnos/${r.id}`)} style={{ cursor: 'pointer' }}>
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
                            onClick={() => doScreenAction(r.id, 'confirm', 'Turno')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-sage"
                          >
                            {actionLoading === `${r.id}-confirm` ? '…' : 'Confirmar'}
                          </button>
                        )}
                        {r.allowedTransitions?.includes('CANCELLED') && (
                          <button
                            onClick={() => doScreenAction(r.id, 'cancel', 'Turno')}
                            disabled={actionLoading !== null}
                            className="btn-mini btn-mini-clay"
                          >
                            {actionLoading === `${r.id}-cancel` ? '…' : 'Cancelar'}
                          </button>
                        )}
                        {r.allowedTransitions?.includes('COMPLETED') && (
                          <button
                            onClick={() => doScreenAction(r.id, 'complete', 'Turno')}
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
            {/* K4 (23/08/2026, pendientes-2026-08-23.md) — mismo patrón que
                dashboard/reservas/page.tsx: el backend ya soporta asignación
                automática por categoría, solo faltaba exponerla acá. */}
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
                    .filter(r => serviceResourceIds.has(r.id))
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
            // Sin servicio, o bookingMode 'event' — fecha/hora exactas a
            // mano (ver comentario junto a isBlockBooking/isSlotService
            // más arriba). Inicio y Fin quedan los dos obligatorios a
            // propósito: le da al motor de disponibilidad una duración
            // real para chequear solapamiento, no un instante sin fin.
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
    </div>
  )
}
