'use client'
import { useState, useEffect } from 'react'
import { useTable, useCreate, useUpdate, useDelete } from '@refinedev/core'
import { categoriesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import ResourceLockPicker from '@/components/ResourceLockPicker'
import RatePlanManager from '@/components/RatePlanManager'
import ScheduleManager from '@/components/ScheduleManager'
import type { BookableService, Category, BookingMode } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Acento brass (core, sin gate de módulo). ResourceLockPicker (modal de
// recursos bloqueados) queda con su texto interno sin retintar a propósito
// — es un componente compartido chico, gris-sobre-blanco sigue siendo
// legible, no vale la pena editarlo para un solo consumidor todavía.

type FormState = {
  name: string
  categoryId: string
  description: string
  // null = sin elegir todavía -- sin opción pre-seleccionada (28/08/2026,
  // diseno-taxonomia-tipos-reserva-2026-08-28.md §3). Antes arrancaba en
  // 'slot' ya tildado: quien no tocaba el selector se quedaba con ese modo
  // sin haberlo elegido.
  bookingMode: BookingMode | null
  durationMinutes: number | null
  // '' mientras se tipea (18/08/2026, pedido del dueño) -- ver
  // ProductFormState en dashboard/productos/page.tsx para el mismo criterio.
  price: number | ''
}

const EMPTY: FormState = {
  name: '', categoryId: '', description: '', bookingMode: null, durationMinutes: null, price: '',
}

const MODE_LABEL: Record<BookingMode, string> = {
  slot: 'Turno (duración fija)',
  block: 'Bloque (inicio/fin libre)',
  event: 'Evento (bloque único, precio plano)',
}

/**
 * Selector nombrado de `bookingMode`, copy contextual al `isExclusive` de
 * la categoría elegida -- diseno-taxonomia-tipos-reserva-2026-08-28.md §3b.
 * `is_exclusive` es de la CATEGORÍA (uniforme dentro de ella, no se repite
 * la pregunta acá), `booking_mode` es del SERVICIO -- este selector solo
 * controla el segundo.
 */
function bookingModeOptions(isExclusive: boolean): Array<{ value: BookingMode; title: string; hint: string }> {
  return isExclusive
    ? [
        { value: 'slot',  title: 'Con horario fijo',                  hint: 'Turno de peluquería, spa, consultorio.' },
        { value: 'block', title: 'Por rango de fechas',                hint: 'Estadía / alquiler multi-día (auto, equipo).' },
        { value: 'event', title: 'Bloque único, precio plano',         hint: 'Evento — bloquea el espacio completo.' },
      ]
    : [
        { value: 'slot',  title: 'Con horario fijo, cupo compartido',  hint: 'Clase grupal con horario fijo.' },
        { value: 'block', title: 'Por rango de fechas, cupo compartido', hint: 'Alquiler de varias unidades por día.' },
        { value: 'event', title: 'Bloque único, cupo compartido',      hint: 'Tour / salida grupal.' },
      ]
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
  const [scheduleTarget, setScheduleTarget] = useState<BookableService | null>(null)

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
    // Sin modo elegido -- no se completa el alta (mismo criterio que
    // isExclusive en Categorías). El botón ya queda disabled en este caso,
    // esto es el guard real.
    if (form.bookingMode === null) {
      toast('Elegí cómo se reserva este servicio', 'error')
      return
    }
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
  const selectedCategory = categories.find(c => c.id === form.categoryId) ?? null

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
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
                      {s.bookingMode === 'slot' && (
                        <button onClick={() => setScheduleTarget(s)} className="btn-mini btn-mini-neutral">Horarios</button>
                      )}
                      <button onClick={() => setRatePlanTarget(s)} className="btn-mini btn-mini-neutral">Tarifas</button>
                      <button onClick={() => openEdit(s)} className="btn-mini btn-mini-neutral">Editar</button>
                      <button onClick={() => setDeleteTarget(s)} className="btn-mini btn-mini-danger">Eliminar</button>
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

          {/* Selector nombrado -- diseno-taxonomia-tipos-reserva-2026-08-28.md
              §3b. Copy contextual al is_exclusive de la categoría elegida
              (uniforme dentro de ella); sin categoría todavía, no hay de
              dónde sacar ese contexto -- se pide elegir categoría primero
              en vez de mostrar opciones que después podrían no aplicar. */}
          <div>
            <label className="label">¿Cómo se reserva este servicio?</label>
            {!selectedCategory ? (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Elegí una categoría arriba primero.</p>
            ) : (
              <div className="space-y-2">
                {bookingModeOptions(selectedCategory.isExclusive).map(opt => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13,
                      color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: 10,
                      background: form.bookingMode === opt.value ? 'var(--surface-4)' : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="bookingMode"
                      checked={form.bookingMode === opt.value}
                      onChange={() => setForm(f => ({ ...f, bookingMode: opt.value }))}
                      style={{ accentColor: 'var(--zulu-form-control)', width: 16, height: 16, marginTop: 2 }}
                    />
                    <span>
                      {opt.title}
                      <br />
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {/* Resumen siempre visible, nunca en tooltip ni colapsado -- el
                nombre ayuda a elegir, nunca reemplaza el valor real guardado. */}
            <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
              → Exclusivo: {selectedCategory ? (selectedCategory.isExclusive ? 'sí' : 'no, cupo compartido') : '—'}
              {' · '}Modo: {form.bookingMode ?? '(sin elegir todavía)'}
              {form.bookingMode === 'slot' && ` · Duración fija: ${form.durationMinutes ?? '—'} min`}
            </p>
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
            <button type="submit" disabled={submitting || form.bookingMode === null} className="btn-primary flex-1">
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

      {/* Modal de horarios (19/08/2026, E7a) */}
      {scheduleTarget && (
        <ScheduleManager
          open={scheduleTarget !== null}
          onClose={() => setScheduleTarget(null)}
          service={scheduleTarget}
        />
      )}
    </div>
  )
}
