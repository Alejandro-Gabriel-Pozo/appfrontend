'use client'
import { useState, useEffect, useCallback } from 'react'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'
import { serviceSchedulesApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { BookableService, ServiceSchedule } from '@/lib/types'

interface ScheduleManagerProps {
  open: boolean
  onClose: () => void
  service: BookableService
}

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

type ScheduleFormState = { dayOfWeek: number; startTime: string; maxCapacity: number | '' }
const EMPTY_FORM: ScheduleFormState = { dayOfWeek: 0, startTime: '09:00', maxCapacity: 1 }

/**
 * Gestión de horarios semanales de un servicio "slot" (19/08/2026, E7a —
 * backend listo desde antes, pantalla nueva). Define a qué hora puede
 * arrancar un turno cada día de la semana y cuántos en simultáneo
 * (`maxCapacity`) — la duración de cada turno sale de `service.durationMinutes`,
 * no de acá. Mismo patrón de integración que RatePlanManager: botón por
 * fila en la pantalla de Servicios existente, no una pantalla nueva.
 */
export default function ScheduleManager({ open, onClose, service }: ScheduleManagerProps) {
  const { toast } = useToast()
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ServiceSchedule | null>(null)
  const [form, setForm] = useState<ScheduleFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ServiceSchedule | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setSchedules(await serviceSchedulesApi.list(service.id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [service.id, toast])

  useEffect(() => { if (open) queueMicrotask(load) }, [open, load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function openEdit(s: ServiceSchedule) {
    setEditing(s)
    setForm({ dayOfWeek: s.dayOfWeek, startTime: s.startTime.slice(0, 5), maxCapacity: s.maxCapacity })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const body = {
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        maxCapacity: Number(form.maxCapacity) || 1,
      }
      if (editing) {
        await serviceSchedulesApi.update(service.id, editing.id, body)
        toast('Horario actualizado', 'success')
      } else {
        await serviceSchedulesApi.create(service.id, body)
        toast('Horario agregado', 'success')
      }
      openCreate()
      await load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await serviceSchedulesApi.remove(service.id, deleteTarget.id)
      toast('Horario eliminado', 'success')
      if (editing?.id === deleteTarget.id) openCreate()
      setDeleteTarget(null)
      await load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const sorted = [...schedules].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))

  return (
    <Modal open={open} onClose={onClose} title={`Horarios — ${service.name}`} size="max-w-lg">
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        A qué hora puede arrancar un turno de este servicio, día por día, y cuántos en simultáneo.
        La duración de cada turno ({service.durationMinutes ?? '—'} min) la define el servicio, no el horario.
      </p>

      {loading ? (
        <div className="space-y-2 mb-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-10 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>Sin horarios todavía — sin al menos uno, este servicio no tiene turnos disponibles para reservar.</p>
      ) : (
        <div className="space-y-1.5 mb-4">
          {sorted.map(s => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {DAYS[s.dayOfWeek]} — {s.startTime.slice(0, 5)}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Capacidad: {s.maxCapacity} {s.maxCapacity === 1 ? 'turno' : 'turnos'} simultáneo{s.maxCapacity === 1 ? '' : 's'}
                  {!s.active && ' · inactivo'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEdit(s)} className="btn-mini btn-mini-neutral">Editar</button>
                <button onClick={() => setDeleteTarget(s)} className="btn-mini btn-mini-clay">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>
          {editing ? `Editando ${DAYS[editing.dayOfWeek]} ${editing.startTime.slice(0, 5)}` : 'Nuevo horario'}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Día</label>
            <select
              className="input" value={form.dayOfWeek}
              onChange={e => setForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))}
            >
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Hora</label>
            <input
              type="time" className="input" required
              value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Capacidad</label>
            <input
              type="number" className="input" min={1} required
              value={form.maxCapacity}
              onChange={e => setForm(f => ({ ...f, maxCapacity: e.target.value === '' ? '' : parseInt(e.target.value, 10) }))}
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          {editing && (
            <button type="button" onClick={openCreate} className="btn-secondary">Cancelar edición</button>
          )}
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar horario'}
          </button>
        </div>
      </form>

      <div className="flex justify-end pt-4 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
        <button type="button" onClick={onClose} className="btn-secondary">Cerrar</button>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Eliminar horario?"
        description={deleteTarget ? `Vas a eliminar ${DAYS[deleteTarget.dayOfWeek]} ${deleteTarget.startTime.slice(0, 5)}. Esta acción no se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </Modal>
  )
}
