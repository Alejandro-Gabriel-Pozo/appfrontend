'use client'
import { useState, useEffect, useCallback } from 'react'
import { businessHoursApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { OperatingWindow } from '@/lib/types'

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function MiNegocioPage() {
  const { toast } = useToast()
  const [windows, setWindows] = useState<OperatingWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [addingDay, setAddingDay] = useState<number | null>(null)
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('18:00')
  const [applyAllDays, setApplyAllDays] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setWindows(await businessHoursApi.list())
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  function openAdd(dayOfWeek: number) {
    setAddingDay(dayOfWeek)
    setNewStart('09:00')
    setNewEnd('18:00')
    setApplyAllDays(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (addingDay === null) return
    setSaving(true)
    try {
      const days = applyAllDays ? [0, 1, 2, 3, 4, 5, 6] : [addingDay]
      let created = 0
      let skipped = 0
      for (const dayOfWeek of days) {
        try {
          await businessHoursApi.create({ dayOfWeek, startTime: newStart, endTime: newEnd })
          created++
        } catch (err) {
          // OPERATING_WINDOW_OVERLAP en "aplicar a todos" — se salta ese día
          // (probablemente ya tiene franja) y se sigue con el resto, en vez
          // de abortar todo por un solo conflicto.
          if (applyAllDays) skipped++
          else throw err
        }
      }
      if (applyAllDays) {
        toast(
          skipped > 0
            ? `Franja aplicada a ${created} día${created === 1 ? '' : 's'} — ${skipped} ya tenía${skipped === 1 ? '' : 'n'} una franja que se superponía`
            : 'Franja aplicada a todos los días',
          'success',
        )
      } else {
        toast('Franja agregada', 'success')
      }
      setAddingDay(null)
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: string) {
    try {
      await businessHoursApi.remove(id)
      setWindows(w => w.filter(x => x.id !== id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: '40rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi Negocio</h1>
          <p className="page-subtitle">
            Horario de atención por defecto. Un recurso puntual (ej. un empleado) puede
            tener horario propio que reemplaza a este — se configura en Recursos.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(7)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {DAYS.map((label, dayOfWeek) => {
            const dayWindows = windows.filter(w => w.dayOfWeek === dayOfWeek)
            return (
              <div key={dayOfWeek} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">{label}</p>
                  <button onClick={() => openAdd(dayOfWeek)} className="btn-ghost text-xs">+ Agregar franja</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dayWindows.length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Cerrado</p>
                  )}
                  {dayWindows.map(w => (
                    <span
                      key={w.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400"
                    >
                      {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                      <button onClick={() => handleRemove(w.id)} className="hover:text-white" aria-label="Quitar franja">×</button>
                    </span>
                  ))}
                </div>
                {addingDay === dayOfWeek && (
                  <form onSubmit={handleAdd} className="mt-3 pt-3 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex items-end gap-2">
                      <div>
                        <label className="label">Desde</label>
                        <input type="time" className="input" value={newStart} onChange={e => setNewStart(e.target.value)} required />
                      </div>
                      <div>
                        <label className="label">Hasta</label>
                        <input type="time" className="input" value={newEnd} onChange={e => setNewEnd(e.target.value)} required />
                      </div>
                      <button type="submit" disabled={saving} className="btn-primary">
                        {saving ? <span className="spinner" /> : 'Guardar'}
                      </button>
                      <button type="button" onClick={() => setAddingDay(null)} className="btn-secondary">Cancelar</button>
                    </div>
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={applyAllDays} onChange={e => setApplyAllDays(e.target.checked)} />
                      Aplicar este horario a todos los días de la semana
                    </label>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
