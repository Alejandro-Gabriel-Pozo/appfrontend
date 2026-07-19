'use client'
import { useState, useEffect, useCallback } from 'react'
import { categoriesApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { Category } from '@/lib/types'

export default function CategoriasPage() {
  const { toast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await categoriesApi.list())
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '' })
    setModalOpen(true)
  }

  function openEdit(c: Category) {
    setEditing(c)
    setForm({ name: c.name, description: c.description ?? '' })
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editing) {
        await categoriesApi.update(editing.id, form)
        toast('Categoría actualizada', 'success')
      } else {
        await categoriesApi.create({ ...form, fields: [] })
        toast('Categoría creada', 'success')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await categoriesApi.remove(deleteTarget.id)
      toast('Categoría eliminada', 'success')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Categorías</h1>
          <p className="text-sm text-slate-400 mt-0.5">Tipos de recursos (cabañas, mesas, servicios…)</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva categoría
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p className="text-slate-400 font-medium">Sin categorías todavía</p>
          <p className="text-slate-600 text-sm mt-1">Creá la primera con el botón de arriba</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(c => (
            <div key={c.id} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-white">{c.name}</p>
                  {c.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{c.description}</p>}
                </div>
                <span className={`shrink-0 ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  c.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'
                }`}>
                  {c.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <p className="text-xs text-slate-500">{c.fields.length} campo{c.fields.length !== 1 ? 's' : ''} definido{c.fields.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-2 mt-auto pt-2 border-t border-white/[0.06]">
                <button onClick={() => openEdit(c)} className="btn-secondary text-xs py-1.5 flex-1">Editar</button>
                <button onClick={() => setDeleteTarget(c)} className="text-xs py-1.5 px-3 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1d27] rounded-xl border border-white/[0.08] w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold text-white">{editing ? 'Editar categoría' : 'Nueva categoría'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded text-slate-400 hover:text-white" aria-label="Cerrar">
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
                <label className="label">Descripción <span className="text-slate-600">(opcional)</span></label>
                <textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción breve…" />
              </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1d27] rounded-xl border border-white/[0.08] w-full max-w-sm shadow-2xl p-6">
            <h2 className="font-semibold text-white mb-2">¿Eliminar categoría?</h2>
            <p className="text-sm text-slate-400 mb-6">Vas a eliminar <span className="text-white font-medium">{deleteTarget.name}</span>. Los recursos asociados perderán su categoría.</p>
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
