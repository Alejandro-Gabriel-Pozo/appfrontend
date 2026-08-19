'use client'
import { useState, useEffect, useCallback } from 'react'
import { businessHoursApi, businessProfileApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { OperatingWindow } from '@/lib/types'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Sin módulo propio — acento brass por defecto (sección 6 del doc).

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Identidad del negocio (punto 5/E5, 15/08/2026): nombre + contacto que ve
// el cliente en el mail de reserva confirmada, en vez de un remitente
// genérico de la plataforma (A2.9 — esto es config por tenant).
function BusinessIdentitySection() {
  const { toast } = useToast()
  const [displayName, setDisplayName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  // HH:MM — el input type="time" no quiere segundos; el backend acepta
  // HH:MM o HH:MM:SS (timeOnly, request.schemas.ts), así que no hace falta
  // agregarlos acá.
  const [checkInTime, setCheckInTime] = useState('14:00')
  const [checkOutTime, setCheckOutTime] = useState('11:00')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const profile = await businessProfileApi.get()
        setDisplayName(profile.displayName ?? '')
        setContactEmail(profile.contactEmail ?? '')
        setCheckInTime(profile.defaultCheckInTime.slice(0, 5))
        setCheckOutTime(profile.defaultCheckOutTime.slice(0, 5))
      } catch (err) {
        toast(extractErrorMessage(err), 'error')
      } finally {
        setLoading(false)
      }
    })
  }, [toast])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await businessProfileApi.update({
        displayName: displayName.trim() || null,
        contactEmail: contactEmail.trim() || null,
        defaultCheckInTime: checkInTime,
        defaultCheckOutTime: checkOutTime,
      })
      toast('Identidad del negocio guardada', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card p-4 h-32 skeleton" />

  return (
    <div className="card p-4">
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Identidad del negocio</p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Así se identifica tu negocio en los mails que reciben tus clientes (ej. confirmación de reserva).
      </p>
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="label">Nombre para mostrar</label>
          <input
            type="text" className="input" value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Ej. Hotel Los Álamos"
          />
        </div>
        <div>
          <label className="label">Email de contacto (reply-to)</label>
          <input
            type="email" className="input" value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            placeholder="contacto@tunegocio.com"
          />
        </div>
        <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex-1">
            <label className="label">Check-in estándar</label>
            <input
              type="time" className="input" value={checkInTime}
              onChange={e => setCheckInTime(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <label className="label">Check-out estándar</label>
            <input
              type="time" className="input" value={checkOutTime}
              onChange={e => setCheckOutTime(e.target.value)}
              required
            />
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Hora de pared que usan Reservas/Estadías por defecto. Un huésped puede pedir
          un horario distinto (early check-in / late check-out) desde el detalle de su
          reserva — queda pendiente de aprobación de recepción.
        </p>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <span className="spinner" /> : 'Guardar'}
        </button>
      </form>
    </div>
  )
}

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

  useEffect(() => { queueMicrotask(load) }, [load])

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
    <div className={`bastion`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
    <div style={{ maxWidth: '40rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Mi Negocio</h1>
          <p className="page-subtitle">
            Horario de atención por defecto. Un recurso puntual (ej. un empleado) puede
            tener horario propio que reemplaza a este — se configura en Recursos.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <BusinessIdentitySection />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(7)].map((_, i) => <div key={i} className="h-14 rounded-lg skeleton" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {DAYS.map((label, dayOfWeek) => {
            const dayWindows = windows.filter(w => w.dayOfWeek === dayOfWeek)
            return (
              <div key={dayOfWeek} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                  <button onClick={() => openAdd(dayOfWeek)} className="btn-ghost text-xs">+ Agregar franja</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {dayWindows.length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Cerrado</p>
                  )}
                  {dayWindows.map(w => (
                    <span key={w.id} className="badge-confirmed" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                      <button onClick={() => handleRemove(w.id)} aria-label="Quitar franja">×</button>
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
    </div>
  )
}
