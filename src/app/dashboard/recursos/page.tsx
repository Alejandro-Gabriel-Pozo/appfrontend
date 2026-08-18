'use client'
import { useState, useEffect } from 'react'
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { useTable, useCreate, useUpdate, useDelete } from '@refinedev/core'
import { categoriesApi, resourceHoursApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { Resource, Category, OperatingWindow } from '@/lib/types'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Acento brass (core, sin gate de módulo).
const fraunces = Fraunces({ subsets: ['latin'], weight: ['300', '500', '600'], variable: '--font-bastion-serif' })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-bastion-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-bastion-mono' })

// basePrice admite '' mientras se tipea (18/08/2026, pedido del dueño) --
// ver ProductFormState en dashboard/productos/page.tsx para el mismo criterio.
type ResourceFormState = Omit<Resource, 'id' | 'basePrice'> & { basePrice: number | '' }

const EMPTY: ResourceFormState = { name: '', categoryId: '', basePrice: '', active: true }

const DAY_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function RecursosPage() {
  const { toast } = useToast()
  // Sin paginación server-side todavía (ver lib/refine/dataProvider.ts) —
  // pagination: { mode: 'off' } trae la lista completa.
  const { result, tableQuery } = useTable<Resource>({ resource: 'recursos', pagination: { mode: 'off' } })
  const resources = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createResource } = useCreate<Resource>()
  const { mutateAsync: updateResource } = useUpdate<Resource>()
  const { mutateAsync: deleteResourceMutation } = useDelete<Resource>()

  const [categories, setCategories] = useState<Category[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)
  const [form, setForm] = useState<ResourceFormState>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null)

  // Horario propio del recurso (override opcional del horario del negocio)
  const [ownHours, setOwnHours] = useState<OperatingWindow[]>([])
  const [hourForm, setHourForm] = useState({ dayOfWeek: 0, startTime: '09:00', endTime: '18:00' })
  const [addingHour, setAddingHour] = useState(false)

  // Categorías no está migrado a esta pantalla (es su propio recurso Refine)
  // — se sigue trayendo directo para el <select>, igual que antes.
  useEffect(() => {
    queueMicrotask(() => {
      categoriesApi.list().then(setCategories).catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

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
      // basePrice puede haber quedado '' (campo vacío) -- se coerciona a
      // number recién acá, no en cada tecleo (ver ResourceFormState).
      const values = { ...form, basePrice: Number(form.basePrice) || 0 }
      if (editing) {
        await updateResource({ resource: 'recursos', id: editing.id, values })
        toast('Recurso actualizado', 'success')
      } else {
        await createResource({ resource: 'recursos', values })
        toast('Recurso creado', 'success')
      }
      setModalOpen(false)
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
      await deleteResourceMutation({ resource: 'recursos', id: deleteTarget.id })
      toast('Recurso eliminado', 'success')
      setDeleteTarget(null)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? id

  return (
    <div className={`bastion ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Recursos</h1>
          <p className="page-subtitle">Mesas, cabañas, servicios reservables</p>
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
            <div key={i} className="h-14 rounded-lg skeleton" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="card empty-state">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3>Sin recursos todavía</h3>
          <p>Creá el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Precio base</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {resources.map(r => (
                <tr key={r.id}>
                  <td className="table-cell-primary">{r.name}</td>
                  <td><span className="badge-completed">{getCatName(r.categoryId)}</span></td>
                  <td className="mono">${r.basePrice.toLocaleString('es-AR')}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(r)} className="btn-mini btn-mini-neutral">Editar</button>
                      <button onClick={() => setDeleteTarget(r)} className="btn-mini btn-mini-clay">Eliminar</button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontWeight: 600, fontSize: 15 }}>{editing ? 'Editar recurso' : 'Nuevo recurso'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded" style={{ color: 'var(--text-tertiary)' }} aria-label="Cerrar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input
                  className="input"
                  style={fieldErrors['name'] ? { borderColor: 'var(--danger)' } : undefined}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Mesa 4, Cabaña del Río"
                  required
                />
                {fieldErrors['name'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['name']}</p>}
              </div>
              <div>
                <label className="label">Categoría</label>
                <select
                  className="input"
                  style={fieldErrors['categoryId'] ? { borderColor: 'var(--danger)' } : undefined}
                  value={form.categoryId}
                  onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  required
                >
                  <option value="">Seleccioná una categoría…</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {fieldErrors['categoryId'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['categoryId']}</p>}
              </div>
              <div>
                <label className="label">Precio base ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="input"
                  style={fieldErrors['basePrice'] ? { borderColor: 'var(--danger)' } : undefined}
                  value={form.basePrice}
                  onChange={e => setForm(f => ({ ...f, basePrice: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                  required
                />
                {fieldErrors['basePrice'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['basePrice']}</p>}
              </div>

              {editing && (
                <div>
                  <label className="label">Horario propio (opcional)</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Si no cargás nada, este recurso usa el horario de &quot;Mi Negocio&quot;. Útil para
                    un empleado con horario distinto al del negocio (ej. un barbero part-time).
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {ownHours.length === 0 && (
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin horario propio — hereda el del negocio.</p>
                    )}
                    {ownHours.map(w => (
                      <span key={w.id} className="badge-confirmed" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {DAY_LABEL[w.dayOfWeek]} {w.startTime.slice(0, 5)}–{w.endTime.slice(0, 5)}
                        <button type="button" onClick={() => handleRemoveHour(w.id)} aria-label="Quitar franja">×</button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}>
          <div className="card p-6" style={{ width: '100%', maxWidth: 400 }}>
            <h2 style={{ fontWeight: 600, marginBottom: 8 }}>¿Eliminar recurso?</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Vas a eliminar <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{deleteTarget.name}</span>. Esta acción no se puede deshacer.
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
