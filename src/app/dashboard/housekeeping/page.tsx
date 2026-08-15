'use client'
import { useState, useEffect, useCallback } from 'react'
import { housekeepingApi, resourcesApi, usersApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/Modal'
import type { HousekeepingTask, HousekeepingStatus, Shift, Resource, TeamMember } from '@/lib/types'

const STATUS_LABEL: Record<HousekeepingStatus, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignada',
  IN_PROGRESS: 'En curso',
  DONE: 'Terminada',
  INSPECTED: 'Inspeccionada',
  OUT_OF_SERVICE: 'Fuera de servicio',
}

const STATUS_CLASS: Record<HousekeepingStatus, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-400',
  ASSIGNED: 'bg-blue-500/10 text-blue-400',
  IN_PROGRESS: 'bg-purple-500/10 text-purple-400',
  DONE: 'bg-emerald-500/10 text-emerald-400',
  INSPECTED: 'bg-emerald-500/20 text-emerald-300',
  OUT_OF_SERVICE: 'bg-red-500/10 text-red-400',
}

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

  const [tasks, setTasks] = useState<HousekeepingTask[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [date, setDate] = useState(todayStr())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ resourceId: '', shift: 'MORNING' as Shift, notes: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionValue, setActionValue] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, r, m] = await Promise.all([
        housekeepingApi.listByDate(date),
        resourcesApi.list(),
        usersApi.list(),
      ])
      setTasks(t)
      setResources(r)
      setMembers(m)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [date, toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  const getResourceName = (id: string) => resources.find(r => r.id === id)?.name ?? id.slice(0, 8) + '…'
  const getMemberEmail = (id: string | null) => id ? members.find(m => m.identityId === id || m.id === id)?.email ?? id.slice(0, 8) + '…' : '—'

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      await housekeepingApi.create({
        resourceId: createForm.resourceId,
        shift: createForm.shift,
        scheduledFor: new Date(date).toISOString(),
        ...(createForm.notes && { notes: createForm.notes }),
      })
      toast('Tarea creada', 'success')
      setCreateOpen(false)
      setCreateForm({ resourceId: '', shift: 'MORNING', notes: '' })
      load()
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
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  function openAction(type: 'assign' | 'complete' | 'outOfService', task: HousekeepingTask) {
    setPendingAction({ type, task } as PendingAction)
    setActionValue('')
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
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Housekeeping</h1>
          <p className="text-sm text-slate-400 mt-0.5">Tablero de limpieza por turno</p>
        </div>
        {isManagement && (
          <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Planificar tarea
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <label className="label mb-0">Fecha</label>
        <input type="date" className="input w-44" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <p className="text-slate-400 font-medium">Sin tareas planificadas para esta fecha</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Recurso</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Turno</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Asignado a</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {tasks.map(t => (
                <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5 font-medium text-white">{getResourceName(t.resourceId)}</td>
                  <td className="px-4 py-3.5 text-slate-300">{SHIFT_LABEL[t.shift]}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs">{getMemberEmail(t.assignedTo)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {/* "Asignar" se ofrece solo desde PENDING a propósito (asignación
                          inicial) — el dominio técnicamente permite reasignar desde
                          ASSIGNED/IN_PROGRESS/DONE también, pero esa es una acción
                          distinta que esta UI no expone. No usa allowedTransitions
                          porque acá el chequeo es más angosto que lo que el backend
                          permite (A3, docs/pendientes-2026-08-13.md). */}
                      {t.status === 'PENDING' && isManagement && (
                        <button onClick={() => openAction('assign', t)} className="text-xs px-2.5 py-1.5 rounded-md bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]">Asignar</button>
                      )}
                      {t.allowedTransitions?.includes('IN_PROGRESS') && (
                        <button
                          onClick={() => doSimpleAction(t, 'start')}
                          disabled={actionLoading !== null}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50"
                        >
                          {actionLoading === `${t.id}-start` ? '…' : 'Iniciar'}
                        </button>
                      )}
                      {t.allowedTransitions?.includes('DONE') && (
                        <button onClick={() => openAction('complete', t)} className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">Completar</button>
                      )}
                      {t.allowedTransitions?.includes('INSPECTED') && (
                        <button
                          onClick={() => doSimpleAction(t, 'inspect')}
                          disabled={actionLoading !== null}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          {actionLoading === `${t.id}-inspect` ? '…' : 'Inspeccionar'}
                        </button>
                      )}
                      {isManagement && t.allowedTransitions?.includes('PENDING') && (
                        <button
                          onClick={() => doSimpleAction(t, 'reset')}
                          disabled={actionLoading !== null}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
                        >
                          {actionLoading === `${t.id}-reset` ? '…' : 'Reactivar'}
                        </button>
                      )}
                      {isManagement && t.allowedTransitions?.includes('OUT_OF_SERVICE') && (
                        <button onClick={() => openAction('outOfService', t)} className="text-xs px-2.5 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20">Fuera de servicio</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal planificar tarea */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Planificar tarea">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Recurso</label>
            <select
              className={`input ${fieldErrors['resourceId'] ? 'border-red-500/60' : ''}`}
              value={createForm.resourceId}
              onChange={e => setCreateForm(f => ({ ...f, resourceId: e.target.value }))}
              required
            >
              <option value="">Seleccioná un recurso…</option>
              {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {fieldErrors['resourceId'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['resourceId']}</p>}
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
          <p className="text-xs text-slate-500">Se planifica para la fecha seleccionada arriba ({date}).</p>
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
                  <p className="mt-1 text-xs text-slate-500">
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
