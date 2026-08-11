'use client'
import { useState, useEffect, useCallback } from 'react'
import { bookableServicesApi, categoriesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import ResourceLockPicker from '@/components/ResourceLockPicker'
import type { BookableService, Category, BookingMode } from '@/lib/types'

type FormState = {
  name: string
  categoryId: string
  description: string
  bookingMode: BookingMode
  durationMinutes: number | null
  price: number
}

const EMPTY: FormState = {
  name: '', categoryId: '', description: '', bookingMode: 'slot', durationMinutes: 30, price: 0,
}

const MODE_LABEL: Record<BookingMode, string> = {
  slot: 'Turno (duración fija)',
  block: 'Bloque (inicio/fin libre)',
  event: 'Evento (horario fijo)',
}

export default function ServiciosPage() {
  const { toast } = useToast()
  const [services, setServices] = useState<BookableService[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BookableService | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<BookableService | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [lockTarget, setLockTarget] = useState<BookableService | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [svc, cats] = await Promise.all([bookableServicesApi.list(), categoriesApi.list()])
      setServices(svc)
      setCategories(cats)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setFieldErrors({})
    setModalOpen(true)
  }

  function openEdit(s: BookableService) {
    setEditing(s)
    setForm({
      name: s.name,
      categoryId: s.categoryId,
      description: s.description ?? '',
      bookingMode: s.bookingMode,
      durationMinutes: s.durationMinutes,
      price: s.price,
    })
    setFieldErrors({})
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      const body = {
        name: form.name,
        categoryId: form.categoryId,
        ...(form.description && { description: form.description }),
        bookingMode: form.bookingMode,
        durationMinutes: form.bookingMode === 'slot' ? form.durationMinutes : null,
        price: form.price,
      }
      if (editing) {
        await bookableServicesApi.update(editing.id, body)
        toast('Servicio actualizado', 'success')
      } else {
        await bookableServicesApi.create(body)
        toast('Servicio creado', 'success')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await bookableServicesApi.remove(deleteTarget.id)
      toast('Servicio eliminado', 'success')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? id

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Servicios</h1>
          <p className="text-sm text-slate-400 mt-0.5">Servicios agendables y qué recursos físicos bloquean</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo servicio
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-slate-400 font-medium">Sin servicios todavía</p>
          <p className="text-slate-600 text-sm mt-1">Creá el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Categoría</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Duración</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Precio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Modo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {services.map(s => (
                <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5 font-medium text-white">{s.name}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                      {getCatName(s.categoryId)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-300">
                    {s.durationMinutes != null ? `${s.durationMinutes} min` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-slate-300">${s.price.toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs">{MODE_LABEL[s.bookingMode]}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setLockTarget(s)}
                        className="text-xs px-2.5 py-1.5 rounded-md bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] transition-colors"
                      >
                        Recursos
                      </button>
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors" aria-label="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteTarget(s)} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" aria-label="Eliminar">
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar servicio' : 'Nuevo servicio'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input
              className={`input ${fieldErrors['name'] ? 'border-red-500/60' : ''}`}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Corte de pelo, Tintura"
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
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {fieldErrors['categoryId'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['categoryId']}</p>}
          </div>

          <div>
            <label className="label">Modo de reserva</label>
            <select
              className="input"
              value={form.bookingMode}
              onChange={e => setForm(f => ({ ...f, bookingMode: e.target.value as BookingMode }))}
            >
              {(Object.keys(MODE_LABEL) as BookingMode[]).map(m => (
                <option key={m} value={m}>{MODE_LABEL[m]}</option>
              ))}
            </select>
          </div>

          {form.bookingMode === 'slot' && (
            <div>
              <label className="label">Duración (minutos)</label>
              <input
                type="number"
                min={1}
                className={`input ${fieldErrors['durationMinutes'] ? 'border-red-500/60' : ''}`}
                value={form.durationMinutes ?? ''}
                onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value ? parseInt(e.target.value, 10) : null }))}
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                No se puede ajustar al reservar — si hace falta otra duración, creá un servicio distinto.
              </p>
              {fieldErrors['durationMinutes'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['durationMinutes']}</p>}
            </div>
          )}

          <div>
            <label className="label">Precio ($)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className={`input ${fieldErrors['price'] ? 'border-red-500/60' : ''}`}
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
              required
            />
            {fieldErrors['price'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['price']}</p>}
          </div>

          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <span className="spinner" /> : null}
              {editing ? 'Guardar cambios' : 'Crear servicio'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmar borrado */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Eliminar servicio?"
        description={`Vas a eliminar "${deleteTarget?.name}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />

      {/* Modal de recursos bloqueados */}
      {lockTarget && (
        <ResourceLockPicker
          open={lockTarget !== null}
          onClose={() => setLockTarget(null)}
          service={lockTarget}
        />
      )}
    </div>
  )
}
