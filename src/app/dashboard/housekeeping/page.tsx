'use client'
import { useState, useEffect, useMemo } from 'react'
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { useTable, useCreate, useInvalidate } from '@refinedev/core'
import { housekeepingApi, resourcesApi, usersApi, categoriesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/Modal'
import type { HousekeepingTask, HousekeepingStatus, Shift, Resource, TeamMember, Category } from '@/lib/types'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Segunda pantalla migrada (18/08/2026) — módulo PMS, acento brass, patrón
// "rack": una ficha de color por recurso en vez de una tabla genérica (es el
// elemento señal del sistema para housekeeping, sección 4 del doc).
const fraunces = Fraunces({ subsets: ['latin'], weight: ['300', '500', '600'], variable: '--font-bastion-serif' })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-bastion-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-bastion-mono' })

const STATUS_LABEL: Record<HousekeepingStatus, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignada',
  IN_PROGRESS: 'En curso',
  DONE: 'Terminada',
  INSPECTED: 'Inspeccionada',
  OUT_OF_SERVICE: 'Fuera de servicio',
}

// Semáforo Bastión (sección 5 del doc, mismo criterio que Reservas):
// pending=brass, en curso/asignada=gris neutro, terminada/inspeccionada=sage,
// fuera de servicio=clay. badge-* ya vive en globals.css con esa paleta.
const STATUS_BADGE_CLASS: Record<HousekeepingStatus, string> = {
  PENDING: 'badge-pending',
  ASSIGNED: 'badge-completed',
  IN_PROGRESS: 'badge-completed',
  DONE: 'badge-confirmed',
  INSPECTED: 'badge-confirmed',
  OUT_OF_SERVICE: 'badge-cancelled',
}

// Ficha del rack — fondo/borde/punto por estado, mismo semáforo de arriba
// pero en versión "bloque de color" en vez de pill (principio 4 del doc:
// escaneable como bloque desde lejos, clave en operación de mostrador).
const STATUS_TILE: Record<HousekeepingStatus, { bg: string; border: string; dot: string }> = {
  PENDING:        { bg: 'var(--bastion-brass-soft)',  border: 'var(--bastion-brass)', dot: 'var(--bastion-brass)' },
  ASSIGNED:       { bg: 'var(--bastion-neutral-bg)',  border: '#C7CCDA',              dot: 'var(--bastion-neutral-text)' },
  IN_PROGRESS:    { bg: 'var(--bastion-neutral-bg)',  border: '#C7CCDA',              dot: 'var(--bastion-neutral-text)' },
  DONE:           { bg: 'var(--bastion-sage-bg)',     border: 'var(--bastion-sage)',  dot: 'var(--bastion-sage)' },
  INSPECTED:      { bg: 'var(--bastion-sage-bg)',     border: 'var(--bastion-sage)',  dot: 'var(--bastion-sage)' },
  OUT_OF_SERVICE: { bg: 'var(--bastion-clay-bg)',     border: 'var(--bastion-clay)',  dot: 'var(--bastion-clay)' },
}
const EMPTY_TILE = { bg: 'var(--bastion-card)', border: 'var(--bastion-line)', dot: 'var(--bastion-line)' }

const SHIFT_LABEL: Record<Shift, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

type PendingAction =
  | { type: 'assign'; task: HousekeepingTask }
  | { type: 'complete'; task: HousekeepingTask }
  | { type: 'outOfService'; task: HousekeepingTask }
  | null

export default function HousekeepingPage() {
  const { toast } = useToast()
  const { user: currentUser } = useAuth()
  const isManagement = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN'

  const [date, setDate] = useState(todayStr())
  // housekeeping filtra por fecha vía meta.date (ver lib/refine/dataProvider.ts
  // — housekeepingApi.listByDate). Sin paginación server-side todavía.
  const { result, tableQuery } = useTable<HousekeepingTask>({
    resource: 'housekeeping',
    pagination: { mode: 'off' },
    meta: { date },
  })
  const tasks = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createTask } = useCreate<HousekeepingTask>()
  // assign/start/complete/inspect/outOfService/reset son acciones con nombre
  // que no pasan por el data provider — invalidate() fuerza el refetch.
  const invalidate = useInvalidate()

  const [resources, setResources] = useState<Resource[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ resourceId: '', shift: 'MORNING' as Shift, notes: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionValue, setActionValue] = useState('')

  // Ficha del rack seleccionada — con tarea (detalle + acciones) o sin ella
  // (atajo directo a "Planificar tarea" para ese recurso).
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null)

  // Recursos/usuarios no están migrados a esta pantalla — se siguen
  // trayendo directo, igual que antes.
  useEffect(() => {
    queueMicrotask(() => {
      Promise.all([resourcesApi.list(), usersApi.list(), categoriesApi.list()])
        .then(([r, m, cats]) => { setResources(r); setMembers(m); setCategories(cats) })
        .catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

  // Backlog E1 (13/08/2026, ampliado 18/08 tras encontrar el mismo bug acá) —
  // housekeeping es limpieza de habitaciones/unidades, no tiene sentido para
  // un recurso de servicio (silla de peluquería, mesa). El rack y el
  // selector de "planificar tarea" solo muestran recursos de categorías
  // isLodging=true.
  const lodgingResources = useMemo(() => {
    const lodgingCategoryIds = new Set(categories.filter(c => c.isLodging).map(c => c.id))
    return resources.filter(r => lodgingCategoryIds.has(r.categoryId))
  }, [resources, categories])

  const getMemberEmail = (id: string | null) => id ? members.find(m => m.identityId === id || m.id === id)?.email ?? id.slice(0, 8) + '…' : '—'
  const getTaskForResource = (resourceId: string) => tasks.find(t => t.resourceId === resourceId) ?? null

  function openCreateFor(resourceId?: string) {
    setCreateForm({ resourceId: resourceId ?? '', shift: 'MORNING', notes: '' })
    setFieldErrors({})
    setSelectedResource(null)
    setCreateOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      await createTask({
        resource: 'housekeeping',
        values: {
          resourceId: createForm.resourceId,
          shift: createForm.shift,
          scheduledFor: new Date(date).toISOString(),
          ...(createForm.notes && { notes: createForm.notes }),
        },
      })
      toast('Tarea creada', 'success')
      setCreateOpen(false)
      setCreateForm({ resourceId: '', shift: 'MORNING', notes: '' })
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function doSimpleAction(task: HousekeepingTask, action: 'start' | 'inspect' | 'reset') {
    setActionLoading(`${task.id}-${action}`)
    try {
      const labels = { start: 'Tarea iniciada', inspect: 'Tarea inspeccionada', reset: 'Recurso reactivado' }
      if (action === 'start') await housekeepingApi.start(task.id)
      if (action === 'inspect') await housekeepingApi.inspect(task.id)
      if (action === 'reset') await housekeepingApi.reset(task.id)
      toast(labels[action], 'success')
      invalidate({ resource: 'housekeeping', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  function openAction(type: 'assign' | 'complete' | 'outOfService', task: HousekeepingTask) {
    setPendingAction({ type, task } as PendingAction)
    setActionValue('')
    setSelectedResource(null)
  }

  async function submitAction() {
    if (!pendingAction) return
    const { type, task } = pendingAction
    setActionLoading(`${task.id}-${type}`)
    try {
      if (type === 'assign') {
        if (!actionValue) { toast('Elegí una persona', 'error'); setActionLoading(null); return }
        await housekeepingApi.assign(task.id, actionValue)
        toast('Tarea asignada', 'success')
      } else if (type === 'complete') {
        await housekeepingApi.complete(task.id, actionValue || undefined)
        toast('Tarea completada', 'success')
      } else {
        await housekeepingApi.outOfService(task.id, actionValue || undefined)
        toast('Recurso marcado fuera de servicio', 'success')
      }
      setPendingAction(null)
      invalidate({ resource: 'housekeeping', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const selectedTask = selectedResource ? getTaskForResource(selectedResource.id) : null

  return (
    <div className={`bastion ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Housekeeping</h1>
          <p className="page-subtitle">Tablero de limpieza por turno</p>
        </div>
        {isManagement && (
          <button onClick={() => openCreateFor()} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Planificar tarea
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-2">
        <label className="label mb-0">Fecha</label>
        <input type="date" className="input w-44" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {/* Leyenda del semáforo — mismos colores que las fichas del rack */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
        {(['PENDING', 'ASSIGNED', 'DONE', 'OUT_OF_SERVICE'] as HousekeepingStatus[]).map(s => (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_TILE[s].dot, display: 'inline-block' }} />
            {s === 'ASSIGNED' ? 'Asignada / en curso' : STATUS_LABEL[s]}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid var(--bastion-line)', display: 'inline-block' }} />
          Sin tarea
        </span>
      </div>

      {/* Rack — una ficha por recurso, coloreada por su estado de housekeeping
          en la fecha elegida (o neutra si no tiene tarea planificada). */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 92, borderRadius: 14 }} />)}
        </div>
      ) : lodgingResources.length === 0 ? (
        <div className="card empty-state">
          <p>No hay ninguna categoría marcada como alojamiento todavía — marcá una en Categorías para poder planificar housekeeping.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {lodgingResources.map(r => {
            const task = getTaskForResource(r.id)
            const tile = task ? STATUS_TILE[task.status] : EMPTY_TILE
            return (
              <button
                key={r.id}
                onClick={() => setSelectedResource(r)}
                style={{
                  position: 'relative',
                  textAlign: 'left',
                  padding: '14px 14px 12px',
                  borderRadius: 14,
                  background: tile.bg,
                  border: `1px solid ${tile.border}`,
                  cursor: 'pointer',
                  minHeight: 92,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 120ms',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', top: 10, right: 10,
                    width: 8, height: 8, borderRadius: '50%',
                    background: task ? tile.dot : 'transparent',
                    border: task ? 'none' : '1px solid var(--bastion-line)',
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--bastion-text)', paddingRight: 14 }}>{r.name}</span>
                <span style={{ fontSize: 11.5, color: 'var(--bastion-slate)' }}>
                  {task ? `${STATUS_LABEL[task.status]} · ${SHIFT_LABEL[task.shift]}` : 'Sin tarea'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Modal detalle de ficha — con tarea: estado + acciones; sin tarea: atajo a planificar */}
      {selectedResource && (
        <Modal open={selectedResource !== null} onClose={() => setSelectedResource(null)} title={selectedResource.name}>
          {selectedTask ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={STATUS_BADGE_CLASS[selectedTask.status]}>{STATUS_LABEL[selectedTask.status]}</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{SHIFT_LABEL[selectedTask.shift]}</span>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Asignado a</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{getMemberEmail(selectedTask.assignedTo)}</p>
              </div>
              {selectedTask.notes && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Notas</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{selectedTask.notes}</p>
                </div>
              )}
              {/* Mismo criterio que la versión en tabla: "Asignar" solo desde
                  PENDING a propósito — ver comentario original más abajo. */}
              <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                {selectedTask.status === 'PENDING' && isManagement && (
                  <button onClick={() => openAction('assign', selectedTask)} className="btn-mini btn-mini-neutral">Asignar</button>
                )}
                {selectedTask.allowedTransitions?.includes('IN_PROGRESS') && (
                  <button
                    onClick={() => doSimpleAction(selectedTask, 'start')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-neutral"
                  >
                    {actionLoading === `${selectedTask.id}-start` ? '…' : 'Iniciar'}
                  </button>
                )}
                {selectedTask.allowedTransitions?.includes('DONE') && (
                  <button onClick={() => openAction('complete', selectedTask)} className="btn-mini btn-mini-sage">Completar</button>
                )}
                {selectedTask.allowedTransitions?.includes('INSPECTED') && (
                  <button
                    onClick={() => doSimpleAction(selectedTask, 'inspect')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-sage"
                  >
                    {actionLoading === `${selectedTask.id}-inspect` ? '…' : 'Inspeccionar'}
                  </button>
                )}
                {isManagement && selectedTask.allowedTransitions?.includes('PENDING') && (
                  <button
                    onClick={() => doSimpleAction(selectedTask, 'reset')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-neutral"
                  >
                    {actionLoading === `${selectedTask.id}-reset` ? '…' : 'Reactivar'}
                  </button>
                )}
                {isManagement && selectedTask.allowedTransitions?.includes('OUT_OF_SERVICE') && (
                  <button onClick={() => openAction('outOfService', selectedTask)} className="btn-mini btn-mini-clay">Fuera de servicio</button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Sin tarea planificada para esta fecha.
              </p>
              {isManagement ? (
                <button onClick={() => openCreateFor(selectedResource.id)} className="btn-primary w-full">
                  Planificar tarea para {selectedResource.name}
                </button>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Solo un gerente/dueño puede planificar tareas.
                </p>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Modal planificar tarea */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Planificar tarea">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Recurso</label>
            <select
              className="input"
              style={fieldErrors['resourceId'] ? { borderColor: 'var(--danger)' } : undefined}
              value={createForm.resourceId}
              onChange={e => setCreateForm(f => ({ ...f, resourceId: e.target.value }))}
              required
            >
              <option value="">Seleccioná un recurso…</option>
              {lodgingResources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {fieldErrors['resourceId'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['resourceId']}</p>}
          </div>
          <div>
            <label className="label">Turno</label>
            <select
              className="input"
              value={createForm.shift}
              onChange={e => setCreateForm(f => ({ ...f, shift: e.target.value as Shift }))}
            >
              {(Object.keys(SHIFT_LABEL) as Shift[]).map(s => <option key={s} value={s}>{SHIFT_LABEL[s]}</option>)}
            </select>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Se planifica para la fecha seleccionada arriba ({date}).</p>
          <div>
            <label className="label">Notas (opcional)</label>
            <textarea className="input" rows={2} value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <span className="spinner" /> : null}
              Crear tarea
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal acción (asignar / completar / fuera de servicio) */}
      {pendingAction && (
        <Modal
          open={pendingAction !== null}
          onClose={() => setPendingAction(null)}
          title={
            pendingAction.type === 'assign' ? 'Asignar tarea' :
            pendingAction.type === 'complete' ? 'Completar tarea' : 'Marcar fuera de servicio'
          }
        >
          <div className="space-y-4">
            {pendingAction.type === 'assign' ? (
              <div>
                <label className="label">Persona</label>
                <select className="input" value={actionValue} onChange={e => setActionValue(e.target.value)}>
                  <option value="">Seleccioná…</option>
                  {members.filter(m => m.active && m.roleName === 'HOUSEKEEPING').map(m => (
                    <option key={m.identityId} value={m.identityId}>{m.email}</option>
                  ))}
                </select>
                {members.filter(m => m.active && m.roleName === 'HOUSEKEEPING').length === 0 && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    No hay personal con rol Limpieza todavía — creá uno en Usuarios.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="label">{pendingAction.type === 'complete' ? 'Notas (opcional)' : 'Motivo (opcional)'}</label>
                <textarea className="input" rows={3} value={actionValue} onChange={e => setActionValue(e.target.value)} />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setPendingAction(null)} className="btn-secondary flex-1">Cancelar</button>
              <button type="button" onClick={submitAction} disabled={actionLoading !== null} className="btn-primary flex-1">
                {actionLoading !== null ? <span className="spinner" /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
