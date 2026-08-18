'use client'
import { useState } from 'react'
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { useTable, useCreate, useUpdate, useDelete } from '@refinedev/core'
import { extractErrorMessage } from '@/lib/api'
import { isPlanLimitError, isPlatformUnavailable, getErrorMessage } from '@/lib/apiErrors'
import { useToast } from '@/context/ToastContext'
import UpgradePrompt, { type PlanLimitPayload } from '@/components/UpgradePrompt'
import type { Category } from '@/lib/types'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Acento brass (core, sin gate de módulo). UpgradePrompt ya usa una paleta
// clara (amarillo sobre blanco) — se ve bien tal cual sobre parchment, sin
// tocarlo.
const fraunces = Fraunces({ subsets: ['latin'], weight: ['300', '500', '600'], variable: '--font-bastion-serif' })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-bastion-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-bastion-mono' })

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
  const [form, setForm]               = useState({ name: '', description: '', isLodging: false })
  const [submitting, setSubmitting]   = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  // Banner 402 — los datos vienen del backend, nunca hardcodeados
  const [limitErr, setLimitErr]       = useState<PlanLimitPayload | null>(null)

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '', isLodging: false })
    setModalOpen(true)
  }

  function openEdit(c: Category) {
    setEditing(c)
    setForm({ name: c.name, description: c.description ?? '', isLodging: c.isLodging })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editing) {
        // UPDATE: no aplica límite de plan
        await updateCategory({ resource: 'categorias', id: editing.id, values: form })
        toast('Categoría actualizada', 'success')
        setModalOpen(false)
      } else {
        // CREATE: puede fallar con 402, 503 o error genérico
        await createCategory({ resource: 'categorias', values: { ...form, fields: [] } })
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
    <div className={`bastion ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
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
              <div className="flex gap-2 mt-auto pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <button onClick={() => openEdit(c)} className="btn-secondary text-xs py-1.5 flex-1">Editar</button>
                <button onClick={() => setDeleteTarget(c)} className="btn-mini btn-mini-clay" style={{ padding: '7px 12px' }}>Eliminar</button>
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
                  style={{ accentColor: 'var(--accent)', width: 16, height: 16, marginTop: 2 }}
                />
                <span>
                  Es alojamiento (habitaciones, cabañas…)
                  <br />
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                    Determina el panel: alojamiento va por Reservas/Estadías, el resto por Turnos.
                  </span>
                </span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
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
