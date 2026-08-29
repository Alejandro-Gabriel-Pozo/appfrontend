'use client'
import { useState } from 'react'
import { useTable, useCreate, useUpdate, useDelete } from '@refinedev/core'
import { extractErrorMessage } from '@/lib/api'
import { isPlanLimitError, isPlatformUnavailable, getErrorMessage } from '@/lib/apiErrors'
import { useToast } from '@/context/ToastContext'
import UpgradePrompt, { type PlanLimitPayload } from '@/components/UpgradePrompt'
import type { Category, CategoryField } from '@/lib/types'

// Draft de campo dinámico en el modal — `_key` es solo para el `key` de
// React en la lista (estable entre reordenamientos), nunca se manda al
// backend.
type FieldDraft = CategoryField & { _key: string }

function emptyFieldDraft(): FieldDraft {
  return { _key: crypto.randomUUID(), name: '', label: '', type: 'text', required: false }
}

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Acento brass (core, sin gate de módulo). UpgradePrompt ya usa una paleta
// clara (amarillo sobre blanco) — se ve bien tal cual sobre parchment, sin
// tocarlo.

export default function CategoriasPage() {
  const { toast } = useToast()
  // Sin paginación server-side todavía (ver lib/refine/dataProvider.ts) —
  // pagination: { mode: 'off' } trae la lista completa tal cual la devuelve
  // categoriesApi.list(), sin que useTable intente paginarla por su cuenta.
  const { result, tableQuery } = useTable<Category>({ resource: 'categorias', pagination: { mode: 'off' } })
  const categories = result.data
  const loading = tableQuery.isLoading

  const { mutateAsync: createCategory } = useCreate<Category>()
  const { mutateAsync: updateCategory } = useUpdate<Category>()
  const { mutateAsync: deleteCategoryMutation } = useDelete<Category>()

  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<Category | null>(null)
  // isExclusive arranca en null -- sin opción pre-seleccionada (28/08/2026,
  // diseno-taxonomia-tipos-reserva-2026-08-28.md §2/§3): el alta no se
  // completa sin elegir explícitamente. Antes de este cambio este campo no
  // tenía NINGÚN control, quedaba siempre en `false` sin que nadie lo
  // eligiera (caso real: Peluquería/Spa cargadas como cupo compartido).
  const [form, setForm] = useState<{ name: string; description: string; isLodging: boolean; isExclusive: boolean | null }>(
    { name: '', description: '', isLodging: false, isExclusive: null },
  )
  const [fieldDrafts, setFieldDrafts] = useState<FieldDraft[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  // Banner 402 — los datos vienen del backend, nunca hardcodeados
  const [limitErr, setLimitErr]       = useState<PlanLimitPayload | null>(null)

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', isLodging: false, isExclusive: null })
    setFieldDrafts([])
    setModalOpen(true)
  }

  function openEdit(c: Category) {
    setEditing(c)
    setForm({ name: c.name, description: c.description ?? '', isLodging: c.isLodging, isExclusive: c.isExclusive })
    setFieldDrafts(c.fields.map(f => ({ ...f, _key: crypto.randomUUID() })))
    setModalOpen(true)
  }

  function addFieldDraft() {
    setFieldDrafts(prev => [...prev, emptyFieldDraft()])
  }

  function updateFieldDraft(key: string, patch: Partial<FieldDraft>) {
    setFieldDrafts(prev => prev.map(f => (f._key === key ? { ...f, ...patch } : f)))
  }

  function removeFieldDraft(key: string) {
    setFieldDrafts(prev => prev.filter(f => f._key !== key))
  }

  // Mismo criterio que CategoryFieldSchema (app-main/src/api/schemas/category.schemas.ts):
  // nombre/label obligatorios, "select" necesita al menos una opción. Valida
  // en el cliente antes de mandar para no gastar un viaje al backend con un
  // 400 evitable — el backend sigue siendo la fuente de verdad.
  function fieldDraftsError(): string | null {
    for (const f of fieldDrafts) {
      if (!f.name.trim() || !f.label.trim()) return 'Todos los campos necesitan nombre y label'
      if (f.type === 'select' && (!f.options || f.options.filter(o => o.trim()).length === 0)) {
        return `El campo "${f.label || f.name}" es de tipo "Opciones" y necesita al menos una opción`
      }
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fieldsErr = fieldDraftsError()
    if (fieldsErr) {
      toast(fieldsErr, 'error')
      return
    }
    // Sin opción elegida en "¿cómo se ocupan los recursos?" -- no se
    // completa el alta (diseno-taxonomia-tipos-reserva-2026-08-28.md §3).
    // El botón ya queda disabled en este caso, esto es el guard real.
    if (form.isExclusive === null) {
      toast('Elegí cómo se ocupan los recursos de esta categoría', 'error')
      return
    }
    const fields: CategoryField[] = fieldDrafts.map(({ _key, ...f }) => ({
      ...f,
      ...(f.type === 'select' && { options: (f.options ?? []).map(o => o.trim()).filter(Boolean) }),
    }))
    const values = { ...form, isExclusive: form.isExclusive, fields }
    setSubmitting(true)
    try {
      if (editing) {
        // UPDATE: no aplica límite de plan
        await updateCategory({ resource: 'categorias', id: editing.id, values })
        toast('Categoría actualizada', 'success')
        setModalOpen(false)
      } else {
        // CREATE: puede fallar con 402, 503 o error genérico
        await createCategory({ resource: 'categorias', values })
        toast('Categoría creada', 'success')
        setModalOpen(false)
      }
    } catch (err) {
      if (!editing) {
        // Manejo por code — datos del error vienen del backend
        if (isPlanLimitError(err)) {
          setLimitErr({ plan: err.plan, limit: err.limit, resource: 'categorías' })
          setModalOpen(false) // cierra el modal, el banner queda visible
        } else if (isPlatformUnavailable(err)) {
          toast(getErrorMessage(err), 'warning')
        } else {
          toast(getErrorMessage(err), 'error')
        }
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
      await deleteCategoryMutation({ resource: 'categorias', id: deleteTarget.id })
      toast('Categoría eliminada', 'success')
      setDeleteTarget(null)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Categorías</h1>
          <p className="page-subtitle">Tipos de recursos (cabañas, mesas, servicios…)</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva categoría
        </button>
      </div>

      {/* Banner 402 — plan y limit vienen del backend */}
      {limitErr && (
        <div className="mb-6">
          <UpgradePrompt
            plan={limitErr.plan}
            limit={limitErr.limit}
            resource={limitErr.resource}
            onDismiss={() => setLimitErr(null)}
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-xl skeleton" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="card empty-state">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <h3>Sin categorías todavía</h3>
          <p>Creá la primera con el botón de arriba</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(c => (
            <div key={c.id} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.name}</p>
                  {c.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>{c.description}</p>}
                </div>
                <span className={c.active ? 'badge-confirmed' : 'badge-completed'} style={{ flexShrink: 0, marginLeft: 8 }}>
                  {c.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.fields.length} campo{c.fields.length !== 1 ? 's' : ''} definido{c.fields.length !== 1 ? 's' : ''}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.isLodging ? 'Alojamiento — Reservas/Estadías' : 'Servicio — Turnos'}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.isExclusive ? 'Exclusivo' : 'Cupo compartido'}</p>
              <div className="flex gap-2 mt-auto pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <button onClick={() => openEdit(c)} className="btn-secondary text-xs py-1.5 flex-1">Editar</button>
                <button onClick={() => setDeleteTarget(c)} className="btn-mini btn-mini-danger" style={{ padding: '7px 12px' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: 448 }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontWeight: 600, fontSize: 15 }}>{editing ? 'Editar categoría' : 'Nueva categoría'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded" style={{ color: 'var(--text-tertiary)' }} aria-label="Cerrar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Cabañas, Mesas de restaurante" required />
              </div>
              <div>
                <label className="label">Descripción <span style={{ color: 'var(--text-tertiary)' }}>(opcional)</span></label>
                <textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción breve…" />
              </div>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={form.isLodging}
                  onChange={e => setForm(f => ({ ...f, isLodging: e.target.checked }))}
                  style={{ accentColor: 'var(--zulu-form-control)', width: 16, height: 16, marginTop: 2 }}
                />
                <span>
                  Es alojamiento (habitaciones, cabañas…)
                  <br />
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                    Determina el panel: alojamiento va por Reservas/Estadías, el resto por Turnos.
                  </span>
                </span>
              </label>

              {/* Selector nombrado -- diseno-taxonomia-tipos-reserva-2026-08-28.md
                  §2/§3. isLodging (arriba) es pricing, ortogonal, queda
                  afuera. Sin opción pre-seleccionada. */}
              <div>
                <label className="label" style={{ marginBottom: 6 }}>¿Cómo se ocupan los recursos de esta categoría?</label>
                <div className="space-y-2">
                  <label
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13,
                      color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 10,
                      background: form.isExclusive === true ? 'var(--surface-4)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="isExclusive"
                      checked={form.isExclusive === true}
                      onChange={() => setForm(f => ({ ...f, isExclusive: true }))}
                      style={{ accentColor: 'var(--zulu-form-control)', width: 16, height: 16, marginTop: 2 }}
                    />
                    <span>
                      Exclusivo — una reserva a la vez
                      <br />
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                        Ej: habitaciones, sillas de peluquería, consultorios, alquiler de auto.
                      </span>
                    </span>
                  </label>
                  <label
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13,
                      color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 10,
                      background: form.isExclusive === false ? 'var(--surface-4)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="isExclusive"
                      checked={form.isExclusive === false}
                      onChange={() => setForm(f => ({ ...f, isExclusive: false }))}
                      style={{ accentColor: 'var(--zulu-form-control)', width: 16, height: 16, marginTop: 2 }}
                    />
                    <span>
                      Cupo compartido — varias reservas hasta un límite
                      <br />
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                        Ej: clases grupales, tours, dormis compartidos.
                      </span>
                    </span>
                  </label>
                </div>
                {/* Resumen siempre visible, nunca en tooltip ni colapsado --
                    el nombre ayuda a elegir, nunca reemplaza el valor real. */}
                <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                  → is_exclusive: {form.isExclusive === null ? '(sin elegir todavía)' : form.isExclusive ? 'true' : 'false'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label" style={{ margin: 0 }}>
                    Campos del formulario de reserva <span style={{ color: 'var(--text-tertiary)' }}>(opcional)</span>
                  </label>
                  <button type="button" onClick={addFieldDraft} className="btn-mini btn-mini-neutral" style={{ fontSize: 12 }}>
                    + Agregar campo
                  </button>
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  El cliente los completa al reservar (ej: cantidad de huéspedes extra, alergias, tamaño de mesa).
                </p>
                {fieldDrafts.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin campos definidos.</p>
                ) : (
                  <div className="space-y-3">
                    {fieldDrafts.map(f => (
                      <div key={f._key} className="p-3 rounded-lg" style={{ border: '1px solid var(--border)' }}>
                        <div className="flex gap-2 mb-2">
                          <input
                            className="input"
                            style={{ fontSize: 13 }}
                            placeholder="Nombre interno (ej: alergias)"
                            value={f.name}
                            onChange={e => updateFieldDraft(f._key, { name: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => removeFieldDraft(f._key)}
                            className="btn-mini btn-mini-danger"
                            aria-label="Quitar campo"
                          >
                            ✕
                          </button>
                        </div>
                        <input
                          className="input mb-2"
                          style={{ fontSize: 13 }}
                          placeholder="Label visible para el cliente"
                          value={f.label}
                          onChange={e => updateFieldDraft(f._key, { label: e.target.value })}
                        />
                        <div className="flex gap-2 mb-2">
                          <select
                            className="input"
                            style={{ fontSize: 13 }}
                            value={f.type}
                            onChange={e => updateFieldDraft(f._key, { type: e.target.value as CategoryField['type'] })}
                          >
                            <option value="text">Texto</option>
                            <option value="number">Número</option>
                            <option value="select">Opciones</option>
                            <option value="boolean">Sí/No</option>
                            <option value="date">Fecha</option>
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            <input
                              type="checkbox"
                              checked={f.required}
                              onChange={e => updateFieldDraft(f._key, { required: e.target.checked })}
                              style={{ accentColor: 'var(--zulu-form-control)', width: 14, height: 14 }}
                            />
                            Obligatorio
                          </label>
                        </div>
                        {f.type === 'select' && (
                          <input
                            className="input"
                            style={{ fontSize: 13 }}
                            placeholder="Opciones separadas por coma (ej: Chica, Mediana, Grande)"
                            value={(f.options ?? []).join(', ')}
                            onChange={e => updateFieldDraft(f._key, { options: e.target.value.split(',').map(o => o.trimStart()) })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={submitting || form.isExclusive === null} className="btn-primary flex-1">
                  {submitting ? <span className="spinner" /> : null}
                  {editing ? 'Guardar cambios' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar borrado */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}>
          <div className="card p-6" style={{ width: '100%', maxWidth: 400 }}>
            <h2 style={{ fontWeight: 600, marginBottom: 8 }}>¿Eliminar categoría?</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Vas a eliminar <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{deleteTarget.name}</span>. Los recursos asociados perderán su categoría.</p>
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
