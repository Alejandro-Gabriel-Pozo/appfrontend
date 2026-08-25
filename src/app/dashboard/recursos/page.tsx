'use client'
import { useState, useEffect } from 'react'
import { useTable, useCreate } from '@refinedev/core'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { categoriesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { Resource, Category } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Acento brass (core, sin gate de módulo).

// basePrice admite '' mientras se tipea (18/08/2026, pedido del dueño) --
// ver ProductFormState en dashboard/productos/page.tsx para el mismo criterio.
type ResourceFormState = Omit<Resource, 'id' | 'basePrice'> & { basePrice: number | '' }

const EMPTY: ResourceFormState = { name: '', categoryId: '', basePrice: '', active: true }

export default function RecursosPage() {
  const { toast } = useToast()
  const router = useRouter()
  // Sin paginación server-side todavía (ver lib/refine/dataProvider.ts) —
  // pagination: { mode: 'off' } trae la lista completa.
  const { result, tableQuery } = useTable<Resource>({ resource: 'recursos', pagination: { mode: 'off' } })
  const resources = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createResource } = useCreate<Resource>()

  const [categories, setCategories] = useState<Category[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ResourceFormState>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Categorías no está migrado a esta pantalla (es su propio recurso Refine)
  // — se sigue trayendo directo para el <select>, igual que antes.
  useEffect(() => {
    queueMicrotask(() => {
      categoriesApi.list().then(setCategories).catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

  function openCreate() {
    setForm(EMPTY)
    setFieldErrors({})
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      // basePrice puede haber quedado '' (campo vacío) -- se coerciona a
      // number recién acá, no en cada tecleo (ver ResourceFormState).
      const values = { ...form, basePrice: Number(form.basePrice) || 0 }
      await createResource({ resource: 'recursos', values })
      toast('Recurso creado', 'success')
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

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? id

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
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
                <tr key={r.id} onClick={() => router.push(`/dashboard/recursos/${r.id}`)} style={{ cursor: 'pointer' }}>
                  <td className="table-cell-primary">{r.name}</td>
                  <td><span className="badge-completed">{getCatName(r.categoryId)}</span></td>
                  <td className="mono">${r.basePrice.toLocaleString('es-AR')}</td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <Link href={`/dashboard/recursos/${r.id}`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>Ver detalle</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90dvh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontWeight: 600, fontSize: 15 }}>Nuevo recurso</h2>
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
              {/* Precio base -- fallback de último nivel para reservar este
                  Recurso DIRECTO, sin pasar por un Servicio del catálogo
                  (que ya trae su propio precio). No es el campo principal
                  de pricing -- se demuestra colapsado para no competir en
                  jerarquía visual con Nombre/Categoría (K5, pendientes-
                  2026-08-23.md). El backend ya lo trata como opcional
                  (default 0, resources.routes.ts) -- sin `required` acá. */}
              <details
                className="rounded-lg"
                style={{ border: '1px solid var(--border)' }}
                open={false}
              >
                <summary
                  className="label"
                  style={{ cursor: 'pointer', padding: '10px 12px', margin: 0 }}
                >
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

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? <span className="spinner" /> : null}
                  Crear recurso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
