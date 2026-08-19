'use client'
import { useState, useEffect } from 'react'
import { useTable, useCreate, useUpdate, useDelete } from '@refinedev/core'
import { categoriesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import ResourceLockPicker from '@/components/ResourceLockPicker'
import RatePlanManager from '@/components/RatePlanManager'
import type { BookableService, Category, BookingMode } from '@/lib/types'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Acento brass (core, sin gate de módulo). ResourceLockPicker (modal de
// recursos bloqueados) queda con su texto interno sin retintar a propósito
// — es un componente compartido chico, gris-sobre-blanco sigue siendo
// legible, no vale la pena editarlo para un solo consumidor todavía.

type FormState = {
  name: string
  categoryId: string
  description: string
  bookingMode: BookingMode
  durationMinutes: number | null
  // '' mientras se tipea (18/08/2026, pedido del dueño) -- ver
  // ProductFormState en dashboard/productos/page.tsx para el mismo criterio.
  price: number | ''
}

const EMPTY: FormState = {
  name: '', categoryId: '', description: '', bookingMode: 'slot', durationMinutes: 30, price: '',
}

const MODE_LABEL: Record<BookingMode, string> = {
  slot: 'Turno (duración fija)',
  block: 'Bloque (inicio/fin libre)',
  event: 'Evento (horario fijo)',
}

export default function ServiciosPage() {
  const { toast } = useToast()
  const { result, tableQuery } = useTable<BookableService>({ resource: 'servicios', pagination: { mode: 'off' } })
  const services = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createService } = useCreate<BookableService>()
  const { mutateAsync: updateService } = useUpdate<BookableService>()
  const { mutateAsync: deleteServiceMutation } = useDelete<BookableService>()

  const [categories, setCategories] = useState<Category[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<BookableService | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<BookableService | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [lockTarget, setLockTarget] = useState<BookableService | null>(null)
  const [ratePlanTarget, setRatePlanTarget] = useState<BookableService | null>(null)

  // Categorías no está migrado a esta pantalla — se sigue trayendo directo
  // para el <select>, igual que antes.
  useEffect(() => {
    queueMicrotask(() => {
      categoriesApi.list().then(setCategories).catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

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
        price: Number(form.price) || 0,
      }
      if (editing) {
        await updateService({ resource: 'servicios', id: editing.id, values: body })
        toast('Servicio actualizado', 'success')
      } else {
        await createService({ resource: 'servicios', values: body })
        toast('Servicio creado', 'success')
      }
      setModalOpen(false)
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
      await deleteServiceMutation({ resource: 'servicios', id: deleteTarget.id })
      toast('Servicio eliminado', 'success')
      setDeleteTarget(null)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? id

  return (
    <div className={`bastion`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Servicios</h1>
          <p className="page-subtitle">Servicios agendables y qué recursos físicos bloquean</p>
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
            <div key={i} className="h-14 rounded-lg skeleton" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="card empty-state">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3>Sin servicios todavía</h3>
          <p>Creá el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Duración</th>
                <th>Precio</th>
                <th>Modo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td className="table-cell-primary">{s.name}</td>
                  <td><span className="badge-completed">{getCatName(s.categoryId)}</span></td>
                  <td className="mono">{s.durationMinutes != null ? `${s.durationMinutes} min` : '—'}</td>
                  <td className="mono">${s.price.toLocaleString('es-AR')}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{MODE_LABEL[s.bookingMode]}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setLockTarget(s)} className="btn-mini btn-mini-neutral">Recursos</button>
                      <button onClick={() => setRatePlanTarget(s)} className="btn-mini btn-mini-neutral">Tarifas</button>
                      <button onClick={() => openEdit(s)} className="btn-mini btn-mini-neutral">Editar</button>
                      <button onClick={() => setDeleteTarget(s)} className="btn-mini btn-mini-clay">Eliminar</button>
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
              className="input"
              style={fieldErrors['name'] ? { borderColor: 'var(--danger)' } : undefined}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Corte de pelo, Tintura"
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
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {fieldErrors['categoryId'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['categoryId']}</p>}
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
                className="input"
                style={fieldErrors['durationMinutes'] ? { borderColor: 'var(--danger)' } : undefined}
                value={form.durationMinutes ?? ''}
                onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value ? parseInt(e.target.value, 10) : null }))}
                required
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                No se puede ajustar al reservar — si hace falta otra duración, creá un servicio distinto.
              </p>
              {fieldErrors['durationMinutes'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['durationMinutes']}</p>}
            </div>
          )}

          <div>
            <label className="label">Precio ($)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className="input"
              style={fieldErrors['price'] ? { borderColor: 'var(--danger)' } : undefined}
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
              required
            />
            {fieldErrors['price'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['price']}</p>}
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

      {/* Modal de tarifas (18/08/2026, spec de mejoras PMS) */}
      {ratePlanTarget && (
        <RatePlanManager
          open={ratePlanTarget !== null}
          onClose={() => setRatePlanTarget(null)}
          service={ratePlanTarget}
        />
      )}
    </div>
  )
}
