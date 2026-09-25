'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTable, useCreate } from '@refinedev/core'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { resourcesApi, customersApi, reservationsApi, categoriesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import type { PaginatedResponse, OffsetPaginatedResponse } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import SignalBadge from '@/components/SignalBadge'
import type { Stay, Resource, Customer, Reservation, Category } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Tercera pantalla migrada (18/08/2026) — módulo PMS, acento brass.

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false })
}

// D-14 (15/09/2026, docs/decisiones-auditoria-fase2-2026-09-15.md #12,
// backend app-main) -- reservationsApi.list() devuelve OffsetPaginatedResponse
// ahora (nunca array plano); customersApi.list() sigue con PaginatedResponse
// o T[] a secas. Este helper solo lee `.data`, presente en las dos formas.
function toArray<T>(res: PaginatedResponse<T> | OffsetPaginatedResponse<T> | T[]): T[] {
  return Array.isArray(res) ? res : res.data
}

export default function EstadiasPage() {
  const { toast } = useToast()
  const router = useRouter()
  // Sin paginación server-side todavía (ver lib/refine/dataProvider.ts).
  const { result, tableQuery } = useTable<Stay>({ resource: 'estadias', pagination: { mode: 'off' } })
  const stays = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: checkInMutation } = useCreate<Stay>()

  const [resources, setResources] = useState<Resource[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [confirmedReservations, setConfirmedReservations] = useState<Reservation[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [checkInOpen, setCheckInOpen] = useState(false)
  // adultos/ninos (18/08/2026, spec de mejoras PMS): se heredan de la
  // reserva elegida (pickReservation) y quedan editables acá para el caso
  // "cambio de última hora" que pide el anexo -- si difieren de lo que ya
  // tenía la reserva, handleCheckIn los corrige con un PUT antes de armar
  // la estadía.
  const [checkInForm, setCheckInForm] = useState({ reservationId: '', resourceId: '', notes: '', adultos: 1, ninos: 0 })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

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
      setConfirmedReservations(toArray(res))
      setCategories(cats)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }, [toast])

  useEffect(() => { queueMicrotask(loadCatalog) }, [loadCatalog])

  // Backlog E1 (13/08/2026, ampliado 18/08) — Estadías es 100% alojamiento:
  // el dropdown de reserva a check-in y el de habitación asignada solo
  // deberían ofrecer recursos/reservas de categorías isLodging=true (una
  // reserva de servicio vieja, creada antes de este cambio, no debería
  // colarse en ninguno de los dos).
  const lodgingResources = useMemo(() => {
    const lodgingCategoryIds = new Set(categories.filter(cat => cat.isLodging).map(cat => cat.id))
    return resources.filter(r => lodgingCategoryIds.has(r.categoryId))
  }, [resources, categories])
  const lodgingResourceIds = useMemo(() => new Set(lodgingResources.map(r => r.id)), [lodgingResources])
  const lodgingConfirmedReservations = useMemo(
    () => confirmedReservations.filter(rv => lodgingResourceIds.has(rv.resourceId)),
    [confirmedReservations, lodgingResourceIds],
  )
  // Idem para la tabla principal — un stay ya existente sobre un recurso de
  // servicio (de antes de este cambio, o creado por error) no debería
  // listarse acá tampoco.
  const lodgingStays = useMemo(
    () => stays.filter(s => lodgingResourceIds.has(s.resourceId)),
    [stays, lodgingResourceIds],
  )

  const getResourceName = (id: string) => resources.find(r => r.id === id)?.name ?? id.slice(0, 8) + '…'
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.fullName ?? id.slice(0, 8) + '…'

  // v11/Fase 1 (25/09/2026) -- mismo criterio que reservas/page.tsx y
  // reservas/[id]/page.tsx: eje independiente de status, ver el docblock de
  // AssignmentStatus en lib/reservas/types.ts. Acá además importa para el
  // check-in en sí: elegir la habitación en este form es lo que confirma la
  // asignación diferida (StayService.checkIn() -> assignDeferred(), backend
  // app-main/src/pms-estadias/stay.service.ts) -- el backend acepta el
  // check-in de una reserva PENDING_ASSIGNMENT sin rechazarlo, así que el
  // indicador es informativo, no un bloqueo.
  const selectedReservation = lodgingConfirmedReservations.find(r => r.id === checkInForm.reservationId)

  function openCheckIn() {
    setCheckInForm({ reservationId: '', resourceId: '', notes: '', adultos: 1, ninos: 0 })
    setFieldErrors({})
    setCheckInOpen(true)
  }

  function pickReservation(reservationId: string) {
    const reservation = lodgingConfirmedReservations.find(r => r.id === reservationId)
    setCheckInForm(f => ({
      ...f,
      reservationId,
      resourceId: reservation?.resourceId ?? f.resourceId,
      adultos: reservation?.adultos ?? 1,
      ninos: reservation?.ninos ?? 0,
    }))
  }

  async function handleCheckIn(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      // Corrige adultos/ninos en la reserva ANTES de armar la estadía, solo
      // si cambiaron respecto a lo que ya tenía cargado (cambio de última
      // hora) -- evita un PUT de más en el caso común de "no cambió nada".
      const original = lodgingConfirmedReservations.find(r => r.id === checkInForm.reservationId)
      if (original && (checkInForm.adultos !== (original.adultos ?? 1) || checkInForm.ninos !== (original.ninos ?? 0))) {
        await reservationsApi.update(checkInForm.reservationId, { adultos: checkInForm.adultos, ninos: checkInForm.ninos })
      }

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

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
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
      ) : lodgingStays.length === 0 ? (
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
              {lodgingStays.map(s => (
                <tr key={s.id} onClick={() => router.push(`/dashboard/estadias/${s.id}`)} style={{ cursor: 'pointer' }}>
                  <td className="table-cell-primary">{getCustomerName(s.customerId)}</td>
                  <td>{getResourceName(s.resourceId)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{fmt(s.checkedInAt)}</td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <Link href={`/dashboard/estadias/${s.id}`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>Ver detalle</Link>
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
              {lodgingConfirmedReservations.map(r => (
                <option key={r.id} value={r.id}>
                  {r.customer.fullName} — {getResourceName(r.resourceId)} — {fmt(r.startTime)}
                  {r.assignmentStatus === 'PENDING_ASSIGNMENT' ? ' (sin asignar)' : ''}
                </option>
              ))}
            </select>
            {lodgingConfirmedReservations.length === 0 && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>No hay reservas confirmadas pendientes de check-in.</p>
            )}
            {/* v11/Fase 1 (25/09/2026) -- un <option> nativo no puede llevar el
                SignalBadge (solo texto plano, de ahí el "(sin asignar)" de
                arriba); acá sí, apenas se elige la reserva. */}
            {selectedReservation?.assignmentStatus === 'PENDING_ASSIGNMENT' && (
              <div className="mt-1 flex items-center gap-1.5">
                <SignalBadge state="unassigned" label="Sin asignar" />
              </div>
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
              {lodgingResources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {/* v11/Fase 1 (25/09/2026) -- si la reserva es PENDING_ASSIGNMENT,
                elegir acá no es "reasignar": es lo que confirma la asignación
                diferida (backend app-main StayService.checkIn() ->
                ReservationService.assignDeferred() -- acepta el check-in sin
                rechazarlo, ver docs de la Fase 2 de esa feature). Mismo
                criterio "no bloquear" que el resto del repo: el backend ya
                valida (categoría, disponibilidad) y sus errores se muestran
                vía el mismo manejo de fieldErrors/toast de más abajo. */}
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {selectedReservation?.assignmentStatus === 'PENDING_ASSIGNMENT'
                ? 'Esta reserva todavía no tiene habitación confirmada — la que elijas acá queda asignada al hacer check-in.'
                : 'Puede ser distinta a la reservada si hubo que reasignar.'}
            </p>
            {fieldErrors['resourceId'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['resourceId']}</p>}
          </div>
          {checkInForm.reservationId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Adultos</label>
                <input
                  type="number"
                  className="input"
                  min={1}
                  value={checkInForm.adultos}
                  onChange={e => setCheckInForm(f => ({ ...f, adultos: e.target.value === '' ? 1 : parseInt(e.target.value, 10) }))}
                  required
                />
              </div>
              <div>
                <label className="label">Niños</label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  value={checkInForm.ninos}
                  onChange={e => setCheckInForm(f => ({ ...f, ninos: e.target.value === '' ? 0 : parseInt(e.target.value, 10) }))}
                />
              </div>
              <p className="col-span-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Heredado de la reserva — corregí acá si hubo un cambio de última hora.
              </p>
            </div>
          )}
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
    </div>
  )
}
