'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useCreate, useInvalidate } from '@refinedev/core'
import Link from 'next/link'
import { housekeepingApi, maintenanceWindowsApi, resourcesApi, usersApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useIsManagement } from '@/hooks/useAuthRole'
import type { HousekeepingTask, HousekeepingStatus, Shift, Resource, TeamMember, LateCheckout, MaintenanceWindow } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Migrado de modal a ruta dedicada (auditoría UX de modales, 25/08/2026,
// docs/auditoria-modales.md) — la ficha del rack abría un modal con tarea,
// late check-out, ventana de mantenimiento y "planificar" en un solo
// overlay. El rack en sí (dashboard/housekeeping/page.tsx) se queda como
// entrada operativa — la propia auditoría lo marcó como patrón correcto,
// solo pedía que la ficha individual tuviera vista persistente.
// `id` acá es el ID DEL RECURSO, no de la tarea — housekeeping no tiene una
// tarea con identidad estable para navegar (una tarea es "recurso + fecha",
// puede no existir), el recurso sí. `date` viaja por query string
// (?date=YYYY-MM-DD), con fallback a hoy — mismo criterio de
// "window.location.search en vez de useSearchParams()" que ya usa
// portal/[businessSlug]/cuenta/reservas/page.tsx (evita el requisito de
// <Suspense> de Next para un read one-shot).
//
// "Mis tareas" (lista del housekeeper logueado) NO migra — no es un detalle
// de un recurso, es una lista de trabajo propia que cruza recursos/fechas;
// se queda con su modal liviano de asignar/completar en la lista.

const STATUS_LABEL: Record<HousekeepingStatus, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignada',
  IN_PROGRESS: 'En curso',
  DONE: 'Terminada',
  INSPECTED: 'Inspeccionada',
  OUT_OF_SERVICE: 'Fuera de servicio',
}
const STATUS_BADGE_CLASS: Record<HousekeepingStatus, string> = {
  PENDING: 'badge-pending',
  ASSIGNED: 'badge-completed',
  IN_PROGRESS: 'badge-completed',
  DONE: 'badge-confirmed',
  INSPECTED: 'badge-confirmed',
  OUT_OF_SERVICE: 'badge-cancelled',
}
const SHIFT_LABEL: Record<Shift, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

// Fecha LOCAL, no UTC — mismo criterio (y mismo bug documentado) que
// dashboard/housekeeping/page.tsx::todayStr().
function todayStr() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function Skeleton({ h = 20, w = '100%', radius = 8 }: { h?: number; w?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: radius }} />
}

export default function HousekeepingResourceDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { toast } = useToast()
  const isManagement = useIsManagement()
  const { mutateAsync: createTask } = useCreate<HousekeepingTask>()
  const invalidate = useInvalidate()

  const [date, setDate] = useState(todayStr())
  useEffect(() => {
    // window.location.search en vez de useSearchParams() -- one-shot al
    // montar, no algo que necesite reaccionar a cambios de URL (mismo
    // criterio que portal/.../cuenta/reservas/page.tsx).
    queueMicrotask(() => {
      const qs = new URLSearchParams(window.location.search)
      const fromUrl = qs.get('date')
      if (fromUrl) setDate(fromUrl)
    })
  }, [])

  const [resource, setResource] = useState<Resource | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [task, setTask] = useState<HousekeepingTask | null>(null)
  const [lateCheckout, setLateCheckout] = useState<LateCheckout | null>(null)
  const [maintenanceWindow, setMaintenanceWindow] = useState<MaintenanceWindow | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [assignOpen, setAssignOpen] = useState(false)
  const [assignValue, setAssignValue] = useState('')
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completeValue, setCompleteValue] = useState('')

  const [mwOpen, setMwOpen] = useState(false)
  const [mwForm, setMwForm] = useState({ startDate: todayStr(), endDate: '', reason: '' })

  const [createForm, setCreateForm] = useState({ shift: 'MORNING' as Shift, notes: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      // Sin GET /api/resources/:id ni "housekeeping por recurso+fecha" --
      // mismo criterio de list+find que el resto de las pantallas sin
      // GET/:id (ver lib/refine/dataProvider.ts, adapters 'recursos' y
      // 'housekeeping').
      const [resources, membersList, tasksToday, lateList, windows] = await Promise.all([
        resourcesApi.list(),
        usersApi.list(),
        housekeepingApi.listByDate(date),
        housekeepingApi.lateCheckouts(date),
        maintenanceWindowsApi.listActive(),
      ])
      const found = resources.find(r => r.id === id)
      if (!found) {
        setNotFound(true)
        return
      }
      setResource(found)
      setMembers(membersList)
      setTask(tasksToday.find(t => t.resourceId === id) ?? null)
      setLateCheckout(lateList.find(l => l.resourceId === id) ?? null)
      // Un recurso solo debería tener una ventana activa a la vez en la
      // práctica -- si hubiera más de una (dato viejo, carrera), la primera.
      setMaintenanceWindow(windows.find(w => w.resourceId === id) ?? null)
      setAssignOpen(false)
      setAssignValue('')
      setCompleteOpen(false)
      setCompleteValue('')
      setMwOpen(false)
      setMwForm({ startDate: todayStr(), endDate: '', reason: '' })
      setCreateForm({ shift: 'MORNING', notes: '' })
      setFieldErrors({})
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [id, date, toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  const assignableMembers = members.filter(m => m.active && m.roleName === 'HOUSEKEEPING')
  const getMemberEmail = (memberId: string | null) =>
    memberId ? members.find(m => m.identityId === memberId || m.id === memberId)?.email ?? memberId.slice(0, 8) + '…' : '—'

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      // `date` es "YYYY-MM-DD" -- new Date(date) a secas lo parsea como
      // medianoche UTC, no local (mismo bug documentado en
      // dashboard/housekeeping/page.tsx::todayStr()). "T00:00" fuerza hora LOCAL.
      await createTask({
        resource: 'housekeeping',
        values: {
          resourceId: id,
          shift: createForm.shift,
          scheduledFor: new Date(`${date}T00:00`).toISOString(),
          ...(createForm.notes && { notes: createForm.notes }),
        },
      })
      toast('Tarea creada', 'success')
      invalidate({ resource: 'housekeeping', invalidates: ['list'] })
      load()
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function doSimpleAction(action: 'start' | 'inspect') {
    if (!task) return
    setActionLoading(action)
    try {
      const labels = { start: 'Tarea iniciada', inspect: 'Tarea inspeccionada' }
      if (action === 'start') await housekeepingApi.start(task.id)
      if (action === 'inspect') await housekeepingApi.inspect(task.id)
      toast(labels[action], 'success')
      invalidate({ resource: 'housekeeping', invalidates: ['list'] })
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleAssign() {
    if (!task) return
    if (!assignValue) { toast('Elegí una persona', 'error'); return }
    setActionLoading('assign')
    try {
      await housekeepingApi.assign(task.id, assignValue)
      toast('Tarea asignada', 'success')
      invalidate({ resource: 'housekeeping', invalidates: ['list'] })
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleComplete() {
    if (!task) return
    setActionLoading('complete')
    try {
      await housekeepingApi.complete(task.id, completeValue || undefined)
      toast('Tarea completada', 'success')
      invalidate({ resource: 'housekeeping', invalidates: ['list'] })
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCreateMaintenanceWindow(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading('maintenanceWindow')
    try {
      await maintenanceWindowsApi.create({
        resourceId: id,
        startDate: mwForm.startDate,
        ...(mwForm.endDate && { endDate: mwForm.endDate }),
        ...(mwForm.reason && { reason: mwForm.reason }),
      })
      toast('Recurso marcado fuera de servicio', 'success')
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  /** Reactivar -- cierra la ventana de mantenimiento vigente (única forma de liberarlo). */
  async function closeMaintenanceWindow() {
    if (!maintenanceWindow) return
    setActionLoading('closeMaintenanceWindow')
    try {
      await maintenanceWindowsApi.close(maintenanceWindow.id)
      toast('Recurso reactivado', 'success')
      load()
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
        <div style={{ display: 'grid', gap: 16 }}>
          <Skeleton h={140} />
          <Skeleton h={220} />
        </div>
      </div>
    )
  }

  // ─── NOT FOUND ───────────────────────────────────────────────────────────
  if (notFound || !resource) {
    return (
      <div className="zulu" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
        <svg style={{ width: 48, height: 48, color: 'var(--text-tertiary)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Recurso no encontrado</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>El ID ingresado no corresponde a ningún recurso.</p>
        <Link href="/dashboard/housekeeping" style={{ color: 'var(--accent)', fontSize: 14 }}>← Volver a Housekeeping</Link>
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
            href="/dashboard/housekeeping"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Housekeeping
          </Link>
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{resource.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="label mb-0">Fecha</label>
          <input type="date" className="input w-44" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      {lateCheckout && (
        <div
          className="mb-4"
          style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--danger-dim)', border: '1px solid var(--danger)', fontSize: 13, color: 'var(--danger)' }}
        >
          ⏰ Late check-out aprobado — no limpiar antes de las <strong>{lateCheckout.approvedCheckOutTime?.slice(0, 5) ?? '—'}</strong>.
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {/* ── Mantenimiento ── */}
        <div className="card">
          <div className="detail-card-header">Mantenimiento</div>
          <div className="detail-card-body">
            {maintenanceWindow ? (
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  🔧 En mantenimiento desde <strong>{maintenanceWindow.startDate}</strong>
                  {maintenanceWindow.endDate ? <> hasta <strong>{maintenanceWindow.endDate}</strong></> : ' (sin fecha de fin)'}.
                </p>
                {maintenanceWindow.reason && <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{maintenanceWindow.reason}</p>}
                {/* Una ventana ya reactivada sigue apareciendo acá hasta que
                    pase su endDate (bloquea el resto del día en que se
                    cerró, por diseño de close()) — sin esto, "Reactivar"
                    seguiría clickeable y daría un 409 confuso. */}
                {maintenanceWindow.closedAt ? (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    Ya se reactivó — sigue bloqueado hasta el final de <strong>{maintenanceWindow.endDate}</strong>, se libera solo después.
                  </p>
                ) : isManagement && (
                  <button onClick={closeMaintenanceWindow} disabled={actionLoading !== null} className="btn-mini btn-mini-neutral mt-3">
                    {actionLoading === 'closeMaintenanceWindow' ? '…' : 'Reactivar'}
                  </button>
                )}
              </div>
            ) : isManagement ? (
              mwOpen ? (
                <form onSubmit={handleCreateMaintenanceWindow} className="space-y-3">
                  <div>
                    <label className="label">Desde</label>
                    <input type="date" className="input" value={mwForm.startDate} onChange={e => setMwForm(f => ({ ...f, startDate: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="label">Hasta (opcional)</label>
                    <input type="date" className="input" value={mwForm.endDate} min={mwForm.startDate} onChange={e => setMwForm(f => ({ ...f, endDate: e.target.value }))} />
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin fecha de fin, el recurso queda fuera de servicio hasta que lo reactivés a mano.</p>
                  </div>
                  <div>
                    <label className="label">Motivo (opcional)</label>
                    <textarea className="input" rows={2} value={mwForm.reason} onChange={e => setMwForm(f => ({ ...f, reason: e.target.value }))} />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setMwOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                    <button type="submit" disabled={actionLoading !== null} className="btn-primary flex-1">
                      {actionLoading === 'maintenanceWindow' ? <span className="spinner" /> : null}
                      Confirmar
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setMwOpen(true)} className="btn-mini btn-mini-clay">Marcar fuera de servicio</button>
              )
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Sin ventana de mantenimiento activa.</p>
            )}
          </div>
        </div>

        {/* ── Tarea del día ── */}
        <div className="card">
          <div className="detail-card-header">Tarea — {date}</div>
          <div className="detail-card-body">
            {task ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={STATUS_BADGE_CLASS[task.status]}>{STATUS_LABEL[task.status]}</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{SHIFT_LABEL[task.shift]}</span>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Asignado a</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getMemberEmail(task.assignedTo)}</p>
                </div>
                {task.notes && (
                  <div>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Notas</p>
                    <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{task.notes}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  {task.status === 'PENDING' && isManagement && (
                    <button onClick={() => setAssignOpen(o => !o)} className="btn-mini btn-mini-neutral">Asignar</button>
                  )}
                  {task.allowedTransitions?.includes('IN_PROGRESS') && (
                    <button onClick={() => doSimpleAction('start')} disabled={actionLoading !== null} className="btn-mini btn-mini-neutral">
                      {actionLoading === 'start' ? '…' : 'Iniciar'}
                    </button>
                  )}
                  {task.allowedTransitions?.includes('DONE') && (
                    <button onClick={() => setCompleteOpen(o => !o)} className="btn-mini btn-mini-sage">Completar</button>
                  )}
                  {task.allowedTransitions?.includes('INSPECTED') && (
                    <button onClick={() => doSimpleAction('inspect')} disabled={actionLoading !== null} className="btn-mini btn-mini-sage">
                      {actionLoading === 'inspect' ? '…' : 'Inspeccionar'}
                    </button>
                  )}
                </div>

                {assignOpen && (
                  <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div>
                      <label className="label">Persona</label>
                      <select className="input" value={assignValue} onChange={e => setAssignValue(e.target.value)}>
                        <option value="">Seleccioná…</option>
                        {assignableMembers.map(m => <option key={m.identityId} value={m.identityId}>{m.email}</option>)}
                      </select>
                      {assignableMembers.length === 0 && (
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>No hay personal con rol Limpieza todavía — creá uno en Usuarios.</p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setAssignOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                      <button type="button" onClick={handleAssign} disabled={actionLoading !== null} className="btn-primary flex-1">
                        {actionLoading === 'assign' ? <span className="spinner" /> : null}
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}

                {completeOpen && (
                  <div className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div>
                      <label className="label">Notas (opcional)</label>
                      <textarea className="input" rows={3} value={completeValue} onChange={e => setCompleteValue(e.target.value)} />
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setCompleteOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                      <button type="button" onClick={handleComplete} disabled={actionLoading !== null} className="btn-primary flex-1">
                        {actionLoading === 'complete' ? <span className="spinner" /> : null}
                        Confirmar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sin tarea planificada para esta fecha.</p>
                {isManagement ? (
                  <form onSubmit={handleCreateTask} className="space-y-3">
                    <div>
                      <label className="label">Turno</label>
                      <select className="input" value={createForm.shift} onChange={e => setCreateForm(f => ({ ...f, shift: e.target.value as Shift }))}>
                        {(Object.keys(SHIFT_LABEL) as Shift[]).map(s => <option key={s} value={s}>{SHIFT_LABEL[s]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Notas (opcional)</label>
                      <textarea className="input" rows={2} value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    {fieldErrors['resourceId'] && <p className="text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['resourceId']}</p>}
                    <button type="submit" disabled={submitting} className="btn-primary w-full">
                      {submitting ? <span className="spinner" /> : null}
                      Planificar tarea para {resource.name}
                    </button>
                  </form>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Solo un gerente/dueño puede planificar tareas.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
