'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useUpdate, useInvalidate } from '@refinedev/core'
import Link from 'next/link'
import { reservationsApi, resourcesApi, bookableServicesApi, customerAccountApi, customersApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { isApiError } from '@/lib/apiErrors'
import { useToast } from '@/context/ToastContext'
import { useIsManagement } from '@/hooks/useAuthRole'
import FacturarButton from '@/components/FacturarButton'
import type { Reservation, ReservationStatus, Resource, BookableService } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Migrado de modal a ruta dedicada (auditoría UX de modales, 25/08/2026,
// docs/auditoria-modales.md) — el modal "Detalle de reserva" reunía
// estado, huéspedes, notas, horario especial, facturación y ajuste de
// precio, con edición inline por toggle (mismo patrón de
// `ordenes/[id]/page.tsx::editingNotes`, replicado acá con `editingDetail`).
// Alta ("Nueva reserva") se queda en modal en dashboard/reservas/page.tsx —
// no se achicó a alta mínima por el mismo motivo que Usuarios: qué pide el
// alta es una decisión de producto aparte, no parte de esta migración de UI.

const STATUS_LABEL: Record<ReservationStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
  EXPIRED: 'Vencida',
}

const STATUS_BADGE_CLASS: Record<ReservationStatus, string> = {
  PENDING: 'badge-pending',
  CONFIRMED: 'badge-confirmed',
  CANCELLED: 'badge-cancelled',
  COMPLETED: 'badge-completed',
  EXPIRED: 'badge-expired',
}

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

// Reservas es 100% alojamiento (E1, 18/08/2026) — se muestra y edita en
// UTC, nunca en hora local (mismo criterio y mismo comentario largo que
// dashboard/reservas/page.tsx::fmt — ver ese archivo para el detalle).
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { dateStyle: 'short', timeZone: 'UTC' })
}
function toUTCDateInput(iso: string) {
  return iso.slice(0, 10)
}
const fmtMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format

function Skeleton({ h = 20, w = '100%', radius = 8 }: { h?: number; w?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: radius }} />
}

export default function ReservaDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { toast } = useToast()
  const isManagement = useIsManagement()
  const { mutateAsync: updateReservation } = useUpdate<Reservation>()
  const invalidate = useInvalidate()

  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [services, setServices] = useState<BookableService[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [editingDetail, setEditingDetail] = useState(false)
  const [detailForm, setDetailForm] = useState({ startTime: '', endTime: '', adultos: 1, ninos: 0 })
  const [detailFieldErrors, setDetailFieldErrors] = useState<Record<string, string>>({})
  const [detailSubmitting, setDetailSubmitting] = useState(false)

  // Ajuste de precio de una reserva CONFIRMED (19/08/2026, pendientes-2026-
  // 08-18.md punto I) — preview de solo lectura, se pide cada vez que se
  // carga la reserva o después de editarla.
  const [priceAdjustment, setPriceAdjustment] = useState<{ currentTotalPrice: number; recalculatedTotalPrice: number; difference: number } | null>(null)
  const [confirmingAdjustment, setConfirmingAdjustment] = useState(false)

  const [chargeTransactionId, setChargeTransactionId] = useState<string | null>(null)
  // INVOICE-CHARGES-GUARD-FRONTEND-02 (11/09/2026) -- viaja en la misma
  // respuesta que ya trae chargeTransactionId (getStatement()), sin
  // request extra.
  const [chargeCoveredByConsolidated, setChargeCoveredByConsolidated] = useState(false)
  // INVOICE-CHARGES-BUTTON-DEADEND-01 (11/09/2026, opción B) -- invoiceId
  // exacto de la consolidada, para el link preciso de FacturarButton.
  const [chargeCoveredByInvoiceId, setChargeCoveredByInvoiceId] = useState<string | undefined>(undefined)
  // INVOICE-CHARGES-GUARD-FRONTEND-RESIDUE-001 (13/09/2026) -- a diferencia
  // de Cuentas Corrientes, acá `reservation.customer` es la representación
  // mínima de bounded context (`{ id, fullName?, email? }`, sin `kind`) --
  // hace falta un fetch aparte a `GET /api/customers/:id` para saber si es
  // COMPANY. Se resuelve en `refreshChargeTransaction`, junto al resto del
  // estado del cargo, no en `load()`, porque solo hace falta cuando el
  // botón Facturar puede llegar a mostrarse.
  const [chargeCustomerKind, setChargeCustomerKind] = useState<'INDIVIDUAL' | 'COMPANY' | undefined>(undefined)

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Horario especial (early check-in / late check-out) — pendientes-2026-08-18.md punto N.
  const [scheduleRequestOpen, setScheduleRequestOpen] = useState(false)
  const [scheduleRequestForm, setScheduleRequestForm] = useState({ requestedCheckInTime: '', requestedCheckOutTime: '' })
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)
  const [scheduleApproveOpen, setScheduleApproveOpen] = useState(false)
  const [scheduleChargeAmount, setScheduleChargeAmount] = useState('')

  // Se pide siempre que se carga/actualiza una reserva CONFIRMED.
  const refreshPriceAdjustment = useCallback(async (r: Reservation) => {
    if (r.status !== 'CONFIRMED') { setPriceAdjustment(null); return }
    try {
      setPriceAdjustment(await reservationsApi.previewPriceAdjustment(r.id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }, [toast])

  // No hay endpoint "financial-transactions?reservationId=" propio -- se
  // reusa el estado de cuenta del cliente (ya trae reservationId por
  // movimiento) en vez de sumar una ruta nueva solo para este botón.
  const refreshChargeTransaction = useCallback(async (r: Reservation) => {
    if (r.status !== 'CONFIRMED' && r.status !== 'COMPLETED') {
      setChargeTransactionId(null); setChargeCoveredByConsolidated(false); setChargeCoveredByInvoiceId(undefined)
      setChargeCustomerKind(undefined)
      return
    }
    try {
      // INVOICE-CHARGES-GUARD-FRONTEND-RESIDUE-001 -- `kind` en paralelo con
      // el statement, ambos gateados por el mismo `r.customer.id`. No es una
      // pantalla migrada a Refine (fetch directo ya era el patrón acá), así
      // que sumar un segundo fetch no rompe ninguna convención -- ver
      // docblock del state de arriba. `allSettled`, no `all`: `kind` es
      // opcional a propósito (ver docblock de `customerKind` en
      // `FacturarButton`) -- si SOLO ese fetch falla, no tiene que tirar
      // abajo el resto del estado del cargo (que sí es indispensable para
      // el botón). Antes de este cambio compartían el mismo `try`, y una
      // falla nueva y ajena (leer el cliente) hubiera ocultado el botón
      // Facturar entero -- un radio de fallo que no existía hasta agregar
      // este fetch.
      const [statementResult, customerResult] = await Promise.allSettled([
        customerAccountApi.getStatement(r.customer.id),
        customersApi.get(r.customer.id),
      ])
      if (statementResult.status === 'rejected') throw statementResult.reason
      const statement = statementResult.value
      const charge = statement.transactions.find(
        tx => tx.type === 'CHARGE' && tx.reservationId === r.id && tx.status !== 'VOIDED' && tx.status !== 'FAILED',
      )
      setChargeTransactionId(charge?.id ?? null)
      setChargeCoveredByConsolidated(charge ? (statement.coveredByConsolidatedTransactionIds?.includes(charge.id) ?? false) : false)
      setChargeCoveredByInvoiceId(
        charge ? statement.coveredByConsolidatedInvoices?.find(c => c.financialTransactionId === charge.id)?.invoiceId : undefined,
      )
      setChargeCustomerKind(customerResult.status === 'fulfilled' ? customerResult.value.kind : undefined)
    } catch {
      setChargeTransactionId(null)
      setChargeCoveredByConsolidated(false)
      setChargeCoveredByInvoiceId(undefined)
      setChargeCustomerKind(undefined)
    }
  }, [])

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      const [r, recs, svcs] = await Promise.all([
        reservationsApi.get(id),
        resourcesApi.list(),
        bookableServicesApi.list(),
      ])
      setReservation(r)
      setResources(recs)
      setServices(svcs)
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
      refreshPriceAdjustment(r)
      refreshChargeTransaction(r)
    } catch (err) {
      if (isApiError(err) && err.code === 'NOT_FOUND') {
        setNotFound(true)
      } else {
        toast(extractErrorMessage(err), 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [id, toast, refreshPriceAdjustment, refreshChargeTransaction])

  useEffect(() => { queueMicrotask(load) }, [load])

  const getResourceName = (rid: string) => resources.find(r => r.id === rid)?.name ?? rid.slice(0, 8) + '…'
  const getServiceName = (sid?: string | null) => sid ? services.find(s => s.id === sid)?.name ?? sid.slice(0, 8) + '…' : null

  async function handleConfirmPriceAdjustment() {
    if (!reservation) return
    setConfirmingAdjustment(true)
    try {
      const updated = await reservationsApi.confirmPriceAdjustment(reservation.id)
      toast('Ajuste de precio confirmado', 'success')
      setReservation(updated)
      setPriceAdjustment(null)
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setConfirmingAdjustment(false)
    }
  }

  async function handleUpdateDetail(e: React.FormEvent) {
    e.preventDefault()
    if (!reservation) return
    setDetailSubmitting(true)
    setDetailFieldErrors({})
    try {
      const { data: updated } = await updateReservation({
        resource: 'reservas',
        id: reservation.id,
        values: {
          startTime: new Date(detailForm.startTime).toISOString(),
          endTime: new Date(detailForm.endTime).toISOString(),
          adultos: detailForm.adultos,
          ninos: detailForm.ninos,
        },
      })
      toast('Reserva actualizada', 'success')
      setReservation(updated)
      setEditingDetail(false)
      refreshPriceAdjustment(updated)
      refreshChargeTransaction(updated)
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setDetailFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setDetailSubmitting(false)
    }
  }

  async function doDetailAction(action: 'confirm' | 'cancel' | 'complete') {
    if (!reservation) return
    setActionLoading(action)
    try {
      const labels = { confirm: 'Reserva confirmada', cancel: 'Reserva cancelada', complete: 'Reserva completada' }
      const updated = await reservationsApi[action](reservation.id)
      toast(labels[action], 'success')
      setReservation(updated)
      refreshPriceAdjustment(updated)
      refreshChargeTransaction(updated)
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function submitScheduleRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!reservation) return
    const { requestedCheckInTime, requestedCheckOutTime } = scheduleRequestForm
    if (!requestedCheckInTime && !requestedCheckOutTime) {
      toast('Pedí una hora de check-in o de check-out', 'error')
      return
    }
    setScheduleSubmitting(true)
    try {
      const updated = await reservationsApi.requestScheduleChange(reservation.id, {
        ...(requestedCheckInTime && { requestedCheckInTime }),
        ...(requestedCheckOutTime && { requestedCheckOutTime }),
      })
      toast('Horario especial pedido — queda pendiente de aprobación', 'success')
      setReservation(updated)
      setScheduleRequestOpen(false)
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setScheduleSubmitting(false)
    }
  }

  async function approveSchedule() {
    if (!reservation) return
    setActionLoading('approve-schedule')
    try {
      const amount = scheduleChargeAmount.trim() === '' ? undefined : parseFloat(scheduleChargeAmount)
      const updated = await reservationsApi.approveScheduleChange(reservation.id, { chargeAmount: amount })
      toast('Horario especial aprobado', 'success')
      setReservation(updated)
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
    if (!reservation) return
    setActionLoading('reject-schedule')
    try {
      const updated = await reservationsApi.rejectScheduleChange(reservation.id)
      toast('Horario especial rechazado', 'success')
      setReservation(updated)
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ─── LOADING ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="zulu" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Skeleton h={16} w={80} />
          <Skeleton h={28} w={220} />
        </div>
        <Skeleton h={360} />
      </div>
    )
  }

  // ─── NOT FOUND ───────────────────────────────────────────────────────────
  if (notFound || !reservation) {
    return (
      <div className="zulu" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
        <svg style={{ width: 48, height: 48, color: 'var(--text-tertiary)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Reserva no encontrada</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>El ID ingresado no corresponde a ninguna reserva.</p>
        <Link href="/dashboard/reservas" style={{ color: 'var(--zulu-link)', fontSize: 14 }}>← Volver a Reservas</Link>
      </div>
    )
  }

  return (
    <div className="zulu" style={{ maxWidth: 640, margin: '0 auto' }}>
      <style>{`
        .detail-card-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .detail-card-body { padding: 20px; }
      `}</style>

      {/* ── Encabezado ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link
            href="/dashboard/reservas"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Reservas
          </Link>
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{reservation.customer.fullName}</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{reservation.customer.email}</p>
        </div>
        <span className={STATUS_BADGE_CLASS[reservation.status]}>{STATUS_LABEL[reservation.status]}</span>
      </div>

      <div className="card">
        <div className="detail-card-header">{editingDetail ? 'Editar reserva' : 'Detalle de reserva'}</div>
        <div className="detail-card-body">
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
              {reservation.status === 'CONFIRMED' && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Esta reserva ya tiene un cobro emitido — el precio no se actualiza solo. Después de guardar
                  vas a ver cuánto cambiaría y vas a tener que confirmarlo aparte.
                </p>
              )}
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
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Recurso</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getResourceName(reservation.resourceId)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Servicio</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getServiceName(reservation.serviceId) ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Check-in</p>
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>{fmt(reservation.startTime)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Check-out</p>
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>{fmt(reservation.endTime)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Precio</p>
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>{fmtMoney(reservation.totalPrice)}</p>
                </div>
                {reservation.partySize != null && reservation.partySize > 1 && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Personas</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{reservation.partySize}</p>
                  </div>
                )}
                {reservation.adultos != null && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Huéspedes</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Adultos: {reservation.adultos} · Niños: {reservation.ninos ?? 0}
                    </p>
                  </div>
                )}
              </div>

              {reservation.notes && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Notas</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{reservation.notes}</p>
                </div>
              )}

              {/* Horario especial (early check-in / late check-out) — pendientes-2026-08-18.md punto N. */}
              {reservation.scheduleApprovalStatus && (
                <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Horario especial pedido</p>
                    <span className={SCHEDULE_STATUS_BADGE_CLASS[reservation.scheduleApprovalStatus]}>
                      {SCHEDULE_STATUS_LABEL[reservation.scheduleApprovalStatus]}
                    </span>
                  </div>
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>
                    {reservation.requestedCheckInTime && `Check-in: ${reservation.requestedCheckInTime.slice(0, 5)}`}
                    {reservation.requestedCheckInTime && reservation.requestedCheckOutTime && '  ·  '}
                    {reservation.requestedCheckOutTime && `Check-out: ${reservation.requestedCheckOutTime.slice(0, 5)}`}
                  </p>
                  {reservation.scheduleApprovalStatus === 'APPROVED' && !!reservation.scheduleChargeAmount && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      Cargo aplicado: {fmtMoney(reservation.scheduleChargeAmount)}
                    </p>
                  )}
                </div>
              )}

              {/* Facturar (pendientes-2026-08-18.md punto T, "qué sigue") —
                  solo aparece si ya existe un CHARGE confirmado para esta
                  reserva (resuelto en refreshChargeTransaction, vía el
                  estado de cuenta del cliente). Mismo componente que usa
                  Cuentas Corrientes. */}
              {chargeTransactionId && (
                <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Comprobante AFIP</p>
                  <FacturarButton
                    financialTransactionId={chargeTransactionId}
                    coveredByConsolidated={chargeCoveredByConsolidated}
                    customerId={reservation.customer.id}
                    coveredByInvoiceId={chargeCoveredByInvoiceId}
                    customerKind={chargeCustomerKind}
                  />
                </div>
              )}

              {/* Ajuste de precio (19/08/2026, pendientes-2026-08-18.md punto I) —
                  solo aparece si hay una diferencia real entre el precio congelado
                  y lo que costaría hoy con las fechas/recurso actuales. Nunca se
                  aplica solo: el empleado confirma a mano. */}
              {priceAdjustment && (
                <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div
                    className="rounded-lg p-3"
                    style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning-border)' }}
                  >
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      Ajuste de precio pendiente
                    </p>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Con las fechas/recurso actuales, el precio sería{' '}
                      <span className="mono">{fmtMoney(priceAdjustment.recalculatedTotalPrice)}</span>
                      {' '}(cobrado: <span className="mono">{fmtMoney(priceAdjustment.currentTotalPrice)}</span>) —{' '}
                      {priceAdjustment.difference > 0
                        ? <>cargo extra de <span className="mono">{fmtMoney(priceAdjustment.difference)}</span></>
                        : <>nota de crédito de <span className="mono">{fmtMoney(Math.abs(priceAdjustment.difference))}</span></>}
                      .
                    </p>
                    {/* Roles.MANAGEMENT en el backend, no FRONT_DESK como el
                        resto de esta pantalla a propósito — quien edita las
                        fechas no debería ser también quien autoriza el
                        cargo/nota de crédito resultante con un segundo click.
                        Acá solo se evita mostrar un botón que el backend
                        igual va a rechazar. */}
                    {isManagement ? (
                      <button
                        onClick={handleConfirmPriceAdjustment}
                        disabled={confirmingAdjustment}
                        className="btn-mini btn-mini-confirm"
                      >
                        {confirmingAdjustment ? '…' : 'Confirmar ajuste'}
                      </button>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        Solo un gerente/dueño puede confirmar este ajuste.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                {(reservation.status === 'PENDING' || reservation.status === 'CONFIRMED') && (
                  <button
                    onClick={() => setEditingDetail(true)}
                    className="btn-mini btn-mini-neutral"
                  >
                    Editar horario
                  </button>
                )}
                {(reservation.status === 'PENDING' || reservation.status === 'CONFIRMED') && (
                  <button
                    onClick={() => setScheduleRequestOpen(o => !o)}
                    className="btn-mini btn-mini-neutral"
                  >
                    {reservation.scheduleApprovalStatus ? 'Volver a pedir horario' : 'Pedir horario especial'}
                  </button>
                )}
                {reservation.scheduleApprovalStatus === 'PENDING' && (
                  <>
                    <button
                      onClick={() => setScheduleApproveOpen(o => !o)}
                      disabled={actionLoading !== null}
                      className="btn-mini btn-mini-confirm"
                    >
                      Aprobar horario
                    </button>
                    <button
                      onClick={rejectSchedule}
                      disabled={actionLoading !== null}
                      className="btn-mini btn-mini-danger"
                    >
                      {actionLoading === 'reject-schedule' ? '…' : 'Rechazar horario'}
                    </button>
                  </>
                )}
                {reservation.allowedTransitions?.includes('CONFIRMED') && (
                  <button
                    onClick={() => doDetailAction('confirm')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-confirm"
                  >
                    {actionLoading === 'confirm' ? '…' : 'Confirmar'}
                  </button>
                )}
                {reservation.allowedTransitions?.includes('CANCELLED') && (
                  <button
                    onClick={() => doDetailAction('cancel')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-danger"
                  >
                    {actionLoading === 'cancel' ? '…' : 'Cancelar reserva'}
                  </button>
                )}
                {reservation.allowedTransitions?.includes('COMPLETED') && (
                  <button
                    onClick={() => doDetailAction('complete')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-neutral"
                  >
                    {actionLoading === 'complete' ? '…' : 'Completar'}
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
                        type="time" lang="es-AR" className="input"
                        value={scheduleRequestForm.requestedCheckInTime}
                        onChange={e => setScheduleRequestForm(f => ({ ...f, requestedCheckInTime: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Check-out pedido</label>
                      <input
                        type="time" lang="es-AR" className="input"
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
                      {actionLoading === 'approve-schedule' ? <span className="spinner" /> : null}
                      Confirmar aprobación
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
