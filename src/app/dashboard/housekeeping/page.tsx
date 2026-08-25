'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTable, useCreate, useInvalidate } from '@refinedev/core'
import { housekeepingApi, maintenanceWindowsApi, resourcesApi, usersApi, categoriesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useIsManagement } from '@/hooks/useAuthRole'
import Modal from '@/components/Modal'
import type { HousekeepingTask, HousekeepingStatus, Shift, Resource, TeamMember, Category, LateCheckout, MaintenanceWindow } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Segunda pantalla migrada (18/08/2026) — módulo PMS, acento brass, patrón
// "rack": una ficha de color por recurso en vez de una tabla genérica (es el
// elemento señal del sistema para housekeeping, sección 4 del doc).

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
  PENDING:        { bg: 'var(--warning-dim)', border: 'var(--warning)', dot: 'var(--warning)' },
  ASSIGNED:       { bg: 'var(--info-dim)',    border: 'var(--info)',    dot: 'var(--info)' },
  IN_PROGRESS:    { bg: 'var(--info-dim)',    border: 'var(--info)',    dot: 'var(--info)' },
  DONE:           { bg: 'var(--success-dim)', border: 'var(--success)', dot: 'var(--success)' },
  INSPECTED:      { bg: 'var(--success-dim)', border: 'var(--success)', dot: 'var(--success)' },
  OUT_OF_SERVICE: { bg: 'var(--danger-dim)',  border: 'var(--danger)',  dot: 'var(--danger)' },
}
const EMPTY_TILE = { bg: 'var(--surface-2)', border: 'var(--border)', dot: 'var(--border)' }

const SHIFT_LABEL: Record<Shift, string> = { MORNING: 'Mañana', AFTERNOON: 'Tarde', NIGHT: 'Noche' }

// Fecha LOCAL, no UTC (mismo patrón que toLocalInput() en useReservationsScreen.ts)
// -- toISOString() corre la fecha un día adelante para cualquier huso detrás de
// UTC (ej. Argentina, UTC-3) apenas pasa la medianoche UTC, que en la práctica
// es bien temprano a la noche hora local. Encontrado en vivo (24/08/2026):
// con reloj real 21:18 hora local (00:18 UTC del día siguiente), el "Desde"
// de una ventana de mantenimiento quedaba en el día siguiente al real, y el
// servidor (que sí calcula "hoy" con el huso del negocio) rechazaba
// "Reactivar" con motivo "no se puede cerrar antes de que empiece".
function todayStr() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type PendingAction =
  | { type: 'assign'; task: HousekeepingTask }
  | { type: 'complete'; task: HousekeepingTask }
  // 24/08/2026 -- reemplaza a { type: 'outOfService'; task }: el mecanismo de
  // bloqueo ahora es una ventana de mantenimiento por RECURSO, no un status
  // de HousekeepingTask -- no depende de que exista una tarea planificada
  // para la fecha elegida.
  | { type: 'maintenanceWindow'; resource: Resource }
  | null

/** Tile "en mantenimiento" -- mismos colores que OUT_OF_SERVICE, pero por ventana de recurso, no por status de tarea. */
const MAINTENANCE_TILE = { bg: 'var(--danger-dim)', border: 'var(--danger)', dot: 'var(--danger)' }

// Vistas nuevas (19/08/2026, E7a) — backend ya existía (GET /housekeeping/me,
// GET /housekeeping/status/:status), sin pantalla hasta ahora. "Mis tareas"
// es la lista del housekeeper logueado, sin filtro de fecha (a diferencia
// del tablero de arriba, que sí es por fecha) — con un filtro de estado
// opcional que, cuando se activa, pasa a traer el tablero COMPLETO filtrado
// por ese estado (todas las fechas/asignados, no solo las propias) vía
// GET /housekeeping/status/:status — útil para management ("mostrame todo
// lo que está EN CURSO ahora mismo"), no solo para un housekeeper individual.
type ViewMode = 'tablero' | 'mis-tareas'

export default function HousekeepingPage() {
  const { toast } = useToast()
  const isManagement = useIsManagement()

  const [viewMode, setViewMode] = useState<ViewMode>('tablero')
  const [myTasks, setMyTasks] = useState<HousekeepingTask[]>([])
  const [myTasksLoading, setMyTasksLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<HousekeepingStatus | 'ALL'>('ALL')

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
  const [lateCheckouts, setLateCheckouts] = useState<LateCheckout[]>([])
  const [maintenanceWindows, setMaintenanceWindows] = useState<MaintenanceWindow[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ resourceId: '', shift: 'MORNING' as Shift, notes: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionValue, setActionValue] = useState('')
  const [mwForm, setMwForm] = useState({ startDate: todayStr(), endDate: '', reason: '' })

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

  // Ventanas de mantenimiento (24/08/2026) -- independientes de la fecha
  // elegida en el tablero: "todavía relevantes" (abiertas o con fin futuro),
  // no "de esta fecha puntual".
  const refreshMaintenanceWindows = useCallback(() => {
    return maintenanceWindowsApi.listActive()
      .then(setMaintenanceWindows)
      .catch(err => toast(extractErrorMessage(err), 'error'))
  }, [toast])

  useEffect(() => {
    queueMicrotask(refreshMaintenanceWindows)
  }, [refreshMaintenanceWindows])

  // Un recurso solo debería tener una ventana activa a la vez en la práctica
  // -- si hubiera más de una (dato viejo, carrera), se muestra la primera.
  const activeWindowByResource = useMemo(() => {
    const map = new Map<string, MaintenanceWindow>()
    for (const w of maintenanceWindows) if (!map.has(w.resourceId)) map.set(w.resourceId, w)
    return map
  }, [maintenanceWindows])

  // Badge de late check-out (18/08/2026, pendientes-2026-08-18.md punto N) —
  // se recalcula por fecha, igual que el tablero de tareas de arriba.
  useEffect(() => {
    queueMicrotask(() => {
      housekeepingApi.lateCheckouts(date)
        .then(setLateCheckouts)
        .catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [date, toast])

  const getLateCheckout = (resourceId: string) => lateCheckouts.find(l => l.resourceId === resourceId) ?? null

  // "Mis tareas" (19/08/2026, E7a) — recarga al cambiar de vista o de filtro
  // de estado. ALL = /housekeeping/me (propias, sin filtro); cualquier otro
  // valor = /housekeeping/status/:status (tablero completo filtrado).
  const loadMyTasks = useCallback(() => {
    setMyTasksLoading(true)
    const request = statusFilter === 'ALL' ? housekeepingApi.me() : housekeepingApi.byStatus(statusFilter)
    request
      .then(setMyTasks)
      .catch(err => toast(extractErrorMessage(err), 'error'))
      .finally(() => setMyTasksLoading(false))
  }, [statusFilter, toast])

  useEffect(() => {
    if (viewMode !== 'mis-tareas') return
    queueMicrotask(loadMyTasks)
  }, [viewMode, loadMyTasks])

  const getResourceName = (resourceId: string) => resources.find(r => r.id === resourceId)?.name ?? resourceId.slice(0, 8) + '…'

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
          // `date` es "YYYY-MM-DD" (date-only) -- new Date(date) a secas lo
          // parsea como medianoche UTC, no local (mismo bug ya documentado
          // arriba en todayStr()). Con huso detrás de UTC (Argentina, UTC-3)
          // eso corre la tarea un día atrás apenas el server la interpreta en
          // el huso del negocio. Agregar "T00:00" fuerza el parseo en hora
          // LOCAL del navegador -- scheduledFor sí necesita datetime completo
          // (housekeeping.schemas.ts exige z.string().datetime()), así que a
          // diferencia de startDate de maintenance windows no alcanza con
          // mandar el string crudo.
          scheduledFor: new Date(`${date}T00:00`).toISOString(),
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

  async function doSimpleAction(task: HousekeepingTask, action: 'start' | 'inspect') {
    setActionLoading(`${task.id}-${action}`)
    try {
      const labels = { start: 'Tarea iniciada', inspect: 'Tarea inspeccionada' }
      if (action === 'start') await housekeepingApi.start(task.id)
      if (action === 'inspect') await housekeepingApi.inspect(task.id)
      toast(labels[action], 'success')
      invalidate({ resource: 'housekeeping', invalidates: ['list'] })
      if (viewMode === 'mis-tareas') loadMyTasks()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  function openAction(type: 'assign' | 'complete', task: HousekeepingTask) {
    setPendingAction({ type, task })
    setActionValue('')
    setSelectedResource(null)
  }

  function openMaintenanceWindowModal(resource: Resource) {
    setPendingAction({ type: 'maintenanceWindow', resource })
    setMwForm({ startDate: todayStr(), endDate: '', reason: '' })
  }

  async function submitAction() {
    if (!pendingAction) return
    if (pendingAction.type === 'maintenanceWindow') {
      const { resource } = pendingAction
      setActionLoading(`${resource.id}-maintenanceWindow`)
      try {
        await maintenanceWindowsApi.create({
          resourceId: resource.id,
          startDate: mwForm.startDate,
          ...(mwForm.endDate && { endDate: mwForm.endDate }),
          ...(mwForm.reason && { reason: mwForm.reason }),
        })
        toast('Recurso marcado fuera de servicio', 'success')
        setPendingAction(null)
        await refreshMaintenanceWindows()
      } catch (err) {
        toast(extractErrorMessage(err), 'error')
      } finally {
        setActionLoading(null)
      }
      return
    }

    const { type, task } = pendingAction
    setActionLoading(`${task.id}-${type}`)
    try {
      if (type === 'assign') {
        if (!actionValue) { toast('Elegí una persona', 'error'); setActionLoading(null); return }
        await housekeepingApi.assign(task.id, actionValue)
        toast('Tarea asignada', 'success')
      } else {
        await housekeepingApi.complete(task.id, actionValue || undefined)
        toast('Tarea completada', 'success')
      }
      setPendingAction(null)
      invalidate({ resource: 'housekeeping', invalidates: ['list'] })
      if (viewMode === 'mis-tareas') loadMyTasks()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  /** Reactivar -- cierra la ventana de mantenimiento vigente del recurso (única forma de liberarlo). */
  async function closeMaintenanceWindow(window: MaintenanceWindow) {
    setActionLoading(`${window.resourceId}-closeMaintenanceWindow`)
    try {
      await maintenanceWindowsApi.close(window.id)
      toast('Recurso reactivado', 'success')
      await refreshMaintenanceWindows()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const selectedTask = selectedResource ? getTaskForResource(selectedResource.id) : null
  const selectedMaintenanceWindow = selectedResource ? activeWindowByResource.get(selectedResource.id) ?? null : null

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
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

      {/* Vistas (19/08/2026, E7a) — Tablero (por fecha, rack) vs. Mis tareas
          (lista propia, sin fecha, con filtro de estado opcional). */}
      <div className="flex items-center gap-1.5 mb-4">
        <button
          onClick={() => setViewMode('tablero')}
          className={viewMode === 'tablero' ? 'btn-mini btn-mini-neutral' : 'btn-mini'}
          style={viewMode === 'tablero' ? undefined : { color: 'var(--text-tertiary)' }}
        >
          Tablero
        </button>
        <button
          onClick={() => setViewMode('mis-tareas')}
          className={viewMode === 'mis-tareas' ? 'btn-mini btn-mini-neutral' : 'btn-mini'}
          style={viewMode === 'mis-tareas' ? undefined : { color: 'var(--text-tertiary)' }}
        >
          Mis tareas
        </button>
      </div>

      {viewMode === 'tablero' ? (
        <>
      <div className="flex items-center gap-3 mb-2">
        <label className="label mb-0">Fecha</label>
        <input type="date" className="input w-44" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {/* Leyenda del semáforo — mismos colores que las fichas del rack */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
        {(['PENDING', 'ASSIGNED', 'DONE'] as HousekeepingStatus[]).map(s => (
          <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_TILE[s].dot, display: 'inline-block' }} />
            {s === 'ASSIGNED' ? 'Asignada / en curso' : STATUS_LABEL[s]}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: MAINTENANCE_TILE.dot, display: 'inline-block' }} />
          En mantenimiento
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1px solid var(--border)', display: 'inline-block' }} />
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
            const maintenanceWindow = activeWindowByResource.get(r.id) ?? null
            // La ventana de mantenimiento manda sobre el estado de la tarea del
            // día -- un recurso puede estar "en mantenimiento" sin ninguna
            // tarea planificada hoy, y eso es justamente lo que hay que ver.
            const tile = maintenanceWindow ? MAINTENANCE_TILE : task ? STATUS_TILE[task.status] : EMPTY_TILE
            const lateCheckout = getLateCheckout(r.id)
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
                    background: (maintenanceWindow || task) ? tile.dot : 'transparent',
                    border: (maintenanceWindow || task) ? 'none' : '1px solid var(--border)',
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', paddingRight: 14 }}>{r.name}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                  {maintenanceWindow
                    ? 'En mantenimiento'
                    : task ? `${STATUS_LABEL[task.status]} · ${SHIFT_LABEL[task.shift]}` : 'Sin tarea'}
                </span>
                {lateCheckout && (
                  <span
                    title={`Late check-out aprobado hasta las ${lateCheckout.approvedCheckOutTime?.slice(0, 5) ?? '—'}`}
                    style={{
                      position: 'absolute', top: 10, left: 10,
                      fontSize: 10, fontWeight: 600, letterSpacing: 0.2,
                      padding: '2px 6px', borderRadius: 999,
                      background: 'var(--danger-dim)', color: 'var(--danger)',
                      border: '1px solid var(--danger)',
                    }}
                  >
                    ⏰ hasta {lateCheckout.approvedCheckOutTime?.slice(0, 5) ?? '—'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
        </>
      ) : (
        <>
      {/* "Mis tareas" (19/08/2026, E7a) — lista, sin fecha. El filtro de
          estado, cuando no es "Todas", trae el tablero completo filtrado
          (todas las fechas/asignados), no solo la lista propia. */}
      <div className="flex items-center gap-3 mb-4">
        <label className="label mb-0">Estado</label>
        <select
          className="input w-52"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as HousekeepingStatus | 'ALL')}
        >
          <option value="ALL">Mis tareas (todas)</option>
          {(Object.keys(STATUS_LABEL) as HousekeepingStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]} — todo el tablero</option>
          ))}
        </select>
      </div>

      {myTasksLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
        </div>
      ) : myTasks.length === 0 ? (
        <div className="card empty-state">
          <p>{statusFilter === 'ALL' ? 'No tenés tareas asignadas.' : `Nada en estado "${STATUS_LABEL[statusFilter]}" en este momento.`}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {myTasks.map(task => (
            <div
              key={task.id}
              className="card p-4 flex items-center justify-between gap-3"
              style={{ borderLeft: `3px solid ${STATUS_TILE[task.status].dot}` }}
            >
              <div>
                <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{getResourceName(task.resourceId)}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {STATUS_LABEL[task.status]} · {SHIFT_LABEL[task.shift]}
                  {statusFilter !== 'ALL' && ` · ${getMemberEmail(task.assignedTo)}`}
                </p>
                {task.notes && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{task.notes}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {task.status === 'PENDING' && isManagement && (
                  <button onClick={() => openAction('assign', task)} className="btn-mini btn-mini-neutral">Asignar</button>
                )}
                {task.allowedTransitions?.includes('IN_PROGRESS') && (
                  <button
                    onClick={() => doSimpleAction(task, 'start')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-neutral"
                  >
                    {actionLoading === `${task.id}-start` ? '…' : 'Iniciar'}
                  </button>
                )}
                {task.allowedTransitions?.includes('DONE') && (
                  <button onClick={() => openAction('complete', task)} className="btn-mini btn-mini-sage">Completar</button>
                )}
                {task.allowedTransitions?.includes('INSPECTED') && (
                  <button
                    onClick={() => doSimpleAction(task, 'inspect')}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-sage"
                  >
                    {actionLoading === `${task.id}-inspect` ? '…' : 'Inspeccionar'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* Modal detalle de ficha — con tarea: estado + acciones; sin tarea: atajo a planificar */}
      {selectedResource && (
        <Modal open={selectedResource !== null} onClose={() => setSelectedResource(null)} title={selectedResource.name}>
          {getLateCheckout(selectedResource.id) && (
            <div
              className="mb-4"
              style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'var(--danger-dim)', border: '1px solid var(--danger)',
                fontSize: 13, color: 'var(--danger)',
              }}
            >
              ⏰ Late check-out aprobado — no limpiar antes de las{' '}
              <strong>{getLateCheckout(selectedResource.id)!.approvedCheckOutTime?.slice(0, 5) ?? '—'}</strong>.
            </div>
          )}
          {/* Ventana de mantenimiento (24/08/2026) -- independiente de la tarea
              del día: un recurso puede estar en mantenimiento sin tarea
              planificada hoy, o con una tarea en curso a la vez. */}
          {selectedMaintenanceWindow ? (
            <div
              className="mb-4"
              style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'var(--danger-dim)', border: '1px solid var(--danger)',
                fontSize: 13, color: 'var(--danger)',
              }}
            >
              <p>
                🔧 En mantenimiento desde <strong>{selectedMaintenanceWindow.startDate}</strong>
                {selectedMaintenanceWindow.endDate ? <> hasta <strong>{selectedMaintenanceWindow.endDate}</strong></> : ' (sin fecha de fin)'}.
              </p>
              {selectedMaintenanceWindow.reason && <p className="mt-1">{selectedMaintenanceWindow.reason}</p>}
              {/* 25/08/2026 (pendientes-2026-08-25.md) -- una ventana ya
                  reactivada sigue apareciendo acá (listActive() la sigue
                  devolviendo hasta que pase su endDate: bloquea el resto
                  del día en que se cerró, por diseño de close()). Antes
                  "Reactivar" seguía visible y clickeable ahí, y tocarlo de
                  nuevo daba un 409 confuso ("MaintenanceWindowAlreadyClosedError")
                  sin explicar nada al staff. */}
              {selectedMaintenanceWindow.closedAt ? (
                <p className="mt-2" style={{ opacity: 0.8 }}>
                  Ya se reactivó — sigue bloqueado hasta el final de{' '}
                  <strong>{selectedMaintenanceWindow.endDate}</strong>, se libera solo después.
                </p>
              ) : isManagement && (
                <button
                  onClick={() => closeMaintenanceWindow(selectedMaintenanceWindow)}
                  disabled={actionLoading !== null}
                  className="btn-mini btn-mini-neutral mt-2"
                >
                  {actionLoading === `${selectedResource.id}-closeMaintenanceWindow` ? '…' : 'Reactivar'}
                </button>
              )}
            </div>
          ) : isManagement && (
            <div className="mb-4 flex justify-end">
              <button onClick={() => openMaintenanceWindowModal(selectedResource)} className="btn-mini btn-mini-clay">
                Marcar fuera de servicio
              </button>
            </div>
          )}
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

      {/* Modal acción (asignar / completar / marcar fuera de servicio) */}
      {pendingAction && (
        <Modal
          open={pendingAction !== null}
          onClose={() => setPendingAction(null)}
          title={
            pendingAction.type === 'assign' ? 'Asignar tarea' :
            pendingAction.type === 'complete' ? 'Completar tarea' :
            `Marcar fuera de servicio — ${pendingAction.resource.name}`
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
            ) : pendingAction.type === 'complete' ? (
              <div>
                <label className="label">Notas (opcional)</label>
                <textarea className="input" rows={3} value={actionValue} onChange={e => setActionValue(e.target.value)} />
              </div>
            ) : (
              <>
                <div>
                  <label className="label">Desde</label>
                  <input
                    type="date" className="input"
                    value={mwForm.startDate}
                    onChange={e => setMwForm(f => ({ ...f, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Hasta (opcional)</label>
                  <input
                    type="date" className="input"
                    value={mwForm.endDate}
                    min={mwForm.startDate}
                    onChange={e => setMwForm(f => ({ ...f, endDate: e.target.value }))}
                  />
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Sin fecha de fin, el recurso queda fuera de servicio hasta que lo reactivés a mano.
                  </p>
                </div>
                <div>
                  <label className="label">Motivo (opcional)</label>
                  <textarea className="input" rows={3} value={mwForm.reason} onChange={e => setMwForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
              </>
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
