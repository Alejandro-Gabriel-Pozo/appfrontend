'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUpdate, useDelete } from '@refinedev/core'
import Link from 'next/link'
import { categoriesApi, resourcesApi, resourceHoursApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Resource, Category, OperatingWindow } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Migrado de overlay a ruta dedicada (auditoría UX de modales, 25/08/2026,
// docs/auditoria-modales.md) — el overlay de edición mezclaba nombre,
// categoría, precio base y horario propio. "Nuevo recurso" se queda en
// modal en dashboard/recursos/page.tsx (mismo criterio que las fases
// anteriores: alta ≠ detalle/edición).

type ResourceFormState = Omit<Resource, 'id' | 'basePrice'> & { basePrice: number | '' }
const DAY_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function Skeleton({ h = 20, w = '100%', radius = 8 }: { h?: number; w?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: radius }} />
}

export default function RecursoDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const { toast } = useToast()
  const { mutateAsync: updateResource } = useUpdate<Resource>()
  const { mutateAsync: deleteResourceMutation } = useDelete<Resource>()

  const [resource, setResource] = useState<Resource | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState<ResourceFormState>({ name: '', categoryId: '', basePrice: '', active: true })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [ownHours, setOwnHours] = useState<OperatingWindow[]>([])
  const [hourForm, setHourForm] = useState({ dayOfWeek: 0, startTime: '09:00', endTime: '18:00' })
  const [addingHour, setAddingHour] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      // Sin GET /api/resources/:id — mismo criterio que el adapter
      // 'recursos' de lib/refine/dataProvider.ts (list() + find por id).
      const [all, cats, hours] = await Promise.all([
        resourcesApi.list(),
        categoriesApi.list(),
        resourceHoursApi.list(id),
      ])
      const found = all.find(r => r.id === id)
      if (!found) {
        setNotFound(true)
        return
      }
      setResource(found)
      setCategories(cats)
      setForm({ name: found.name, categoryId: found.categoryId, basePrice: found.basePrice, active: found.active })
      setOwnHours(hours)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  async function handleAddHour() {
    if (!resource) return
    setAddingHour(true)
    try {
      const window = await resourceHoursApi.create(resource.id, hourForm)
      setOwnHours(h => [...h, window])
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setAddingHour(false)
    }
  }

  async function handleRemoveHour(hourId: string) {
    if (!resource) return
    try {
      await resourceHoursApi.remove(resource.id, hourId)
      setOwnHours(h => h.filter(w => w.id !== hourId))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!resource) return
    setSaving(true)
    setFieldErrors({})
    try {
      // basePrice puede haber quedado '' (campo vacío) -- se coerciona a
      // number recién acá, no en cada tecleo (ver ResourceFormState).
      const values = { ...form, basePrice: Number(form.basePrice) || 0 }
      const { data: updated } = await updateResource({ resource: 'recursos', id: resource.id, values })
      toast('Recurso actualizado', 'success')
      setResource(updated)
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!resource) return
    setDeleting(true)
    try {
      await deleteResourceMutation({ resource: 'recursos', id: resource.id })
      toast('Recurso eliminado', 'success')
      router.push('/dashboard/recursos')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  // ─── LOADING ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="zulu" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Skeleton h={16} w={80} />
          <Skeleton h={28} w={220} />
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <Skeleton h={220} />
          <Skeleton h={140} />
        </div>
      </div>
    )
  }

  // ─── NOT FOUND ───────────────────────────────────────────────────────────
  if (notFound || !resource) {
    return (
      <div className="zulu" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
        <svg style={{ width: 48, height: 48, color: 'var(--text-tertiary)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Recurso no encontrado</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>El ID ingresado no corresponde a ningún recurso.</p>
        <Link href="/dashboard/recursos" style={{ color: 'var(--zulu-link)', fontSize: 14 }}>← Volver a Recursos</Link>
      </div>
    )
  }

  return (
    <div className="zulu" style={{ maxWidth: 640, margin: '0 auto' }}>
      <style>{`
        .detail-card-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .detail-card-body { padding: 20px; }
      `}</style>

      {/* ── Encabezado ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link
            href="/dashboard/recursos"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Recursos
          </Link>
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{resource.name}</h1>
        </div>
        <span className="badge-completed">{categories.find(c => c.id === resource.categoryId)?.name ?? resource.categoryId}</span>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* ── Información ── */}
        <div className="card">
          <div className="detail-card-header">Información</div>
          <div className="detail-card-body">
            <form onSubmit={handleSave} className="space-y-4">
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
              {/* Precio base -- fallback de último nivel para reservar este
                  Recurso DIRECTO, sin pasar por un Servicio del catálogo
                  (que ya trae su propio precio). Colapsado para no competir
                  en jerarquía visual con Nombre/Categoría (K5, pendientes-
                  2026-08-23.md). */}
              <details
                className="rounded-lg"
                style={{ border: '1px solid var(--border)' }}
                open={resource.basePrice > 0}
              >
                <summary className="label" style={{ cursor: 'pointer', padding: '10px 12px', margin: 0 }}>
                  Precio base ($) <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>— caso excepcional</span>
                </summary>
                <div style={{ padding: '0 12px 12px' }}>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    Se usa solo si este recurso se reserva directo, sin elegir un
                    Servicio del catálogo. Si tus reservas siempre pasan por un
                    Servicio, podés dejarlo en 0.
                  </p>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="input"
                    style={fieldErrors['basePrice'] ? { borderColor: 'var(--danger)' } : undefined}
                    value={form.basePrice}
                    onChange={e => setForm(f => ({ ...f, basePrice: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
                  />
                  {fieldErrors['basePrice'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['basePrice']}</p>}
                </div>
              </details>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <span className="spinner" /> : null}
                Guardar cambios
              </button>
            </form>
          </div>
        </div>

        {/* ── Horario propio ── */}
        <div className="card">
          <div className="detail-card-header">Horario propio</div>
          <div className="detail-card-body">
            <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Si no cargás nada, este recurso usa el horario de &quot;Mi Negocio&quot;. Útil para
              un empleado con horario distinto al del negocio (ej. un barbero part-time).
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
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
              <input type="time" lang="es-AR" className="input" value={hourForm.startTime} onChange={e => setHourForm(f => ({ ...f, startTime: e.target.value }))} />
              <input type="time" lang="es-AR" className="input" value={hourForm.endTime} onChange={e => setHourForm(f => ({ ...f, endTime: e.target.value }))} />
              <button type="button" onClick={handleAddHour} disabled={addingHour} className="btn-secondary shrink-0">
                {addingHour ? <span className="spinner" /> : '+ Agregar'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Zona de riesgo ── */}
        <div className="card">
          <div className="detail-card-header">Eliminar</div>
          <div className="detail-card-body">
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              Esta acción no se puede deshacer.
            </p>
            <button type="button" onClick={() => setConfirmDelete(true)} className="btn-mini btn-mini-danger">
              Eliminar recurso
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="¿Eliminar recurso?"
        description={`Vas a eliminar "${resource.name}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
