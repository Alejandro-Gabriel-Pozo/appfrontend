'use client'
import { useState, useEffect, useCallback } from 'react'
import { resourcesApi, categoriesApi, resourceHoursApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { Resource, Category, OperatingWindow } from '@/lib/types'

const EMPTY: Omit<Resource, 'id'> = { name: '', categoryId: '', basePrice: 0, active: true }

const DAY_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function RecursosPage() {
  const { toast } = useToast()
  const [resources, setResources] = useState<Resource[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)
  const [form, setForm] = useState<Omit<Resource, 'id'>>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null)

  // Horario propio del recurso (override opcional del horario del negocio)
  const [ownHours, setOwnHours] = useState<OperatingWindow[]>([])
  const [hourForm, setHourForm] = useState({ dayOfWeek: 0, startTime: '09:00', endTime: '18:00' })
  const [addingHour, setAddingHour] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [res, cats] = await Promise.all([resourcesApi.list(), categoriesApi.list()])
      setResources(res)
      setCategories(cats)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setFieldErrors({})
    setOwnHours([])
    setModalOpen(true)
  }

  async function openEdit(r: Resource) {
    setEditing(r)
    setForm({ name: r.name, categoryId: r.categoryId, basePrice: r.basePrice, active: r.active })
    setFieldErrors({})
    setModalOpen(true)
    try {
      setOwnHours(await resourceHoursApi.list(r.id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  async function handleAddHour() {
    if (!editing) return
    setAddingHour(true)
    try {
      const window = await resourceHoursApi.create(editing.id, hourForm)
      setOwnHours(h => [...h, window])
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setAddingHour(false)
    }
  }

  async function handleRemoveHour(hourId: string) {
    if (!editing) return
    try {
      await resourceHoursApi.remove(editing.id, hourId)
      setOwnHours(h => h.filter(w => w.id !== hourId))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      if (editing) {
        await resourcesApi.update(editing.id, form)
        toast('Recurso actualizado', 'success')
      } else {
        await resourcesApi.create(form)
        toast('Recurso creado', 'success')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe)
      } else {
        toast(extractErrorMessage(err), 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await resourcesApi.remove(deleteTarget.id)
      toast('Recurso eliminado', 'success')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? id

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Recursos</h1>
          <p className="text-sm text-slate-400 mt-0.5">Mesas, cabañas, servicios reservables</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo recurso
        </button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="text-slate-400 font-medium">Sin recursos todavía</p>
          <p className="text-slate-600 text-sm mt-1">Creá el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Precio base</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {resources.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5 font-medium text-white">{r.name}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                      {getCatName(r.categoryId)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-300">${r.basePrice.toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors" aria-label="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" aria-label="Eliminar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1d27] rounded-xl border border-white/[0.08] w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold text-white">{editing ? 'Editar recurso' : 'Nuevo recurso'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-white transition-colors" aria-label="Cerrar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input
                  className={`input ${fieldErrors['name'] ? 'border-red-500/60' : ''}`}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Mesa 4, Cabaña del Río"
                  required
                />
                {fieldErrors['name'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['name']}</p>}
              </div>
              <div>
                <label className="label">Categoría</label>
                <select
                  className={`input ${fieldErrors['categoryId'] ? 'border-red-500/60' : ''}`}
                  value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  required
                >
                  <option value="">Seleccioná una categoría…</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {fieldErrors['categoryId'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['categoryId']}</p>}
              </div>
              <div>
                <label className="label">Precio base ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className={`input ${fieldErrors['basePrice'] ? 'border-red-500/60' : ''}`}
                  value={form.basePrice}
                  onChange={e => setForm(f => ({ ...f, basePrice: parseFloat(e.target.value) || 0 }))}
                  required
                />
                {fieldErrors['basePrice'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['basePrice']}</p>}
              </div>

              {editing && (
                <div>
                  <label className="label">Horario propio (opcional)</label>
                  <p className="text-xs text-slate-500 mb-2">
                    Si no cargás nada, este recurso usa el horario de &quot;Mi Negocio&quot;. Útil para
                    un empleado con horario distinto al del negocio (ej. un barbero part-time).
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {ownHours.length === 0 && (
                      <p className="text-xs text-slate-600">Sin horario propio — hereda el del negocio.</p>
                    )}
                    {ownHours.map(w => (
                      <span key={w.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                        {DAY_LABEL[w.dayOfWeek]} {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                        <button type="button" onClick={() => handleRemoveHour(w.id)} className="hover:text-white" aria-label="Quitar franja">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 items-end">
                    <select className="input" value={hourForm.dayOfWeek} onChange={e => setHourForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))}>
                      {DAY_LABEL.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                    <input type="time" className="input" value={hourForm.startTime} onChange={e => setHourForm(f => ({ ...f, startTime: e.target.value }))} />
                    <input type="time" className="input" value={hourForm.endTime} onChange={e => setHourForm(f => ({ ...f, endTime: e.target.value }))} />
                    <button type="button" onClick={handleAddHour} disabled={addingHour} className="btn-secondary shrink-0">
                      {addingHour ? <span className="spinner" /> : '+ Agregar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? <span className="spinner" /> : null}
                  {editing ? 'Guardar cambios' : 'Crear recurso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar borrado */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1d27] rounded-xl border border-white/[0.08] w-full max-w-sm shadow-2xl p-6">
            <h2 className="font-semibold text-white mb-2">¿Eliminar recurso?</h2>
            <p className="text-sm text-slate-400 mb-6">
              Vas a eliminar <span className="text-white font-medium">{deleteTarget.name}</span>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleDelete} className="btn-danger flex-1">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
