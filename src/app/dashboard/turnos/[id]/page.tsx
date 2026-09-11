'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useUpdate, useInvalidate } from '@refinedev/core'
import Link from 'next/link'
import { reservationsApi, resourcesApi, bookableServicesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { isApiError } from '@/lib/apiErrors'
import { useToast } from '@/context/ToastContext'
import { toLocalInput } from '@/hooks/useReservationsScreen'
import type { Reservation, ReservationStatus, Resource, BookableService } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Migrado de modal a ruta dedicada (auditoría UX de modales, 25/08/2026,
// docs/auditoria-modales.md) — clon deliberado de
// dashboard/reservas/[id]/page.tsx (mismo criterio que la lista: Turnos es
// un clon de Reservas con el filtro de categoría invertido), recortado a
// lo que Turnos de verdad tiene: sin calendario, sin ajuste de precio,
// sin facturación, sin horario especial (todo eso es específico de
// alojamiento). "Nuevo turno" se queda en modal en
// dashboard/turnos/page.tsx — alta, no detalle/edición.

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

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false })
}
const fmtMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format

function Skeleton({ h = 20, w = '100%', radius = 8 }: { h?: number; w?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: radius }} />
}

export default function TurnoDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { toast } = useToast()
  const { mutateAsync: updateReservation } = useUpdate<Reservation>()
  const invalidate = useInvalidate()

  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [resources, setResources] = useState<Resource[]>([])
  const [services, setServices] = useState<BookableService[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [editingDetail, setEditingDetail] = useState(false)
  const [detailForm, setDetailForm] = useState({ startTime: '', endTime: '' })
  const [detailFieldErrors, setDetailFieldErrors] = useState<Record<string, string>>({})
  const [detailSubmitting, setDetailSubmitting] = useState(false)

  const [actionLoading, setActionLoading] = useState<string | null>(null)

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
      setDetailForm({ startTime: toLocalInput(r.startTime), endTime: toLocalInput(r.endTime) })
      setDetailFieldErrors({})
    } catch (err) {
      if (isApiError(err) && err.code === 'NOT_FOUND') {
        setNotFound(true)
      } else {
        toast(extractErrorMessage(err), 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  const getResourceName = (rid: string) => resources.find(r => r.id === rid)?.name ?? rid.slice(0, 8) + '…'
  const getServiceName = (sid?: string | null) => sid ? services.find(s => s.id === sid)?.name ?? sid.slice(0, 8) + '…' : null

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
        },
      })
      toast('Turno actualizado', 'success')
      setReservation(updated)
      setEditingDetail(false)
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
      const labels = { confirm: 'Turno confirmado', cancel: 'Turno cancelado', complete: 'Turno completado' }
      const updated = await reservationsApi[action](reservation.id)
      toast(labels[action], 'success')
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
        <Skeleton h={300} />
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
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Turno no encontrado</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>El ID ingresado no corresponde a ningún turno.</p>
        <Link href="/dashboard/turnos" style={{ color: 'var(--zulu-link)', fontSize: 14 }}>← Volver a Turnos</Link>
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
            href="/dashboard/turnos"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Turnos
          </Link>
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{reservation.customer.fullName}</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{reservation.customer.email}</p>
        </div>
        <span className={STATUS_BADGE_CLASS[reservation.status]}>{STATUS_LABEL[reservation.status]}</span>
      </div>

      <div className="card">
        <div className="detail-card-header">{editingDetail ? 'Editar turno' : 'Detalle de turno'}</div>
        <div className="detail-card-body">
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
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Recurso</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getResourceName(reservation.resourceId)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Servicio</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getServiceName(reservation.serviceId) ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Inicio</p>
                  <p className="text-sm mono" style={{ color: 'var(--text-secondary)' }}>{fmt(reservation.startTime)}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Fin</p>
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
              </div>

              {reservation.notes && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Notas</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{reservation.notes}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                {reservation.status === 'PENDING' && (
                  <button onClick={() => setEditingDetail(true)} className="btn-mini btn-mini-neutral">Editar horario</button>
                )}
                {reservation.allowedTransitions?.includes('CONFIRMED') && (
                  <button onClick={() => doDetailAction('confirm')} disabled={actionLoading !== null} className="btn-mini btn-mini-confirm">
                    {actionLoading === 'confirm' ? '…' : 'Confirmar'}
                  </button>
                )}
                {reservation.allowedTransitions?.includes('CANCELLED') && (
                  <button onClick={() => doDetailAction('cancel')} disabled={actionLoading !== null} className="btn-mini btn-mini-danger">
                    {actionLoading === 'cancel' ? '…' : 'Cancelar turno'}
                  </button>
                )}
                {reservation.allowedTransitions?.includes('COMPLETED') && (
                  <button onClick={() => doDetailAction('complete')} disabled={actionLoading !== null} className="btn-mini btn-mini-neutral">
                    {actionLoading === 'complete' ? '…' : 'Completar'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
