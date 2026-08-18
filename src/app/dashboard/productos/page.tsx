'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { useTable, useCreate, useUpdate, useDelete } from '@refinedev/core'
import { extractErrorMessage } from '@/lib/api'
import type { Product, CreateProductInput, UpdateProductInput } from '@/lib/types'
import { useToast } from '@/context/ToastContext'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Acento clay (POS_RESTAURANTE).
const fraunces = Fraunces({ subsets: ['latin'], weight: ['300', '500', '600'], variable: '--font-bastion-serif' })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-bastion-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-bastion-mono' })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

const EMPTY_CREATE: CreateProductInput = {
  name: '',
  basePrice: 0,
  description: null,
  sku: null,
  categoryId: null,
  hasVariants: false,
  stockQuantity: 0,
  stockMinAlert: 0,
}

// ─── Modal Crear / Editar ─────────────────────────────────────────────────────

type ModalMode = { kind: 'create' } | { kind: 'edit'; product: Product }

function ProductModal({
  mode,
  onClose,
}: {
  mode: ModalMode
  onClose: () => void
}) {
  const { toast } = useToast()
  const isEdit = mode.kind === 'edit'
  const { mutateAsync: createProduct } = useCreate<Product>()
  const { mutateAsync: updateProduct } = useUpdate<Product>()

  const [form, setForm] = useState<CreateProductInput>(
    isEdit
      ? {
          name: mode.product.name,
          basePrice: mode.product.basePrice,
          description: mode.product.description,
          sku: mode.product.sku,
          categoryId: mode.product.categoryId,
          hasVariants: mode.product.hasVariants,
          stockQuantity: mode.product.stockQuantity,
          stockMinAlert: mode.product.stockMinAlert,
        }
      : { ...EMPTY_CREATE },
  )
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setForm(f => ({
      ...f,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
          ? parseFloat(value) || 0
          : value || null,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        const body: UpdateProductInput = { ...form }
        await updateProduct({ resource: 'productos', id: mode.product.id, values: body })
      } else {
        await createProduct({ resource: 'productos', values: form })
      }
      toast(isEdit ? 'Producto actualizado' : 'Producto creado', 'success')
      onClose()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  const field = (label: string, name: keyof CreateProductInput, type: string = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label className="label" style={{ marginBottom: 0 }}>{label}</label>
      <input
        name={name}
        type={type}
        className="input"
        value={type === 'checkbox' ? undefined : (form[name] as string | number) ?? ''}
        checked={type === 'checkbox' ? (form[name] as boolean) : undefined}
        onChange={handleChange}
        step={type === 'number' ? '0.01' : undefined}
        style={{ width: type === 'checkbox' ? undefined : '100%' }}
      />
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            {isEdit ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {field('Nombre *', 'name')}
          {field('Precio base *', 'basePrice', 'number')}
          {field('SKU', 'sku')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>Descripción</label>
            <textarea
              name="description"
              className="input"
              value={form.description ?? ''}
              onChange={handleChange}
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* has_variants toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              name="hasVariants"
              checked={form.hasVariants ?? false}
              onChange={handleChange}
              style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
            />
            Tiene variantes (gestión de stock por variante)
          </label>

          {/* Stock solo si no tiene variantes */}
          {!form.hasVariants && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {field('Stock actual', 'stockQuantity', 'number')}
              {field('Alerta mínima', 'stockMinAlert', 'number')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading || !form.name || form.basePrice < 0} className="btn-primary">
              {loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const { toast } = useToast()
  // Sin paginación server-side todavía (ver lib/refine/dataProvider.ts) —
  // pagination: { mode: 'off' } trae la lista completa tal cual la devuelve
  // productsApi.list(), sin que useTable intente paginarla por su cuenta.
  const { result, tableQuery } = useTable<Product>({ resource: 'productos', pagination: { mode: 'off' } })
  const products = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: deleteProductMutation } = useDelete<Product>()

  const [modal, setModal] = useState<ModalMode | null>(null)
  const [search, setSearch] = useState('')

  async function handleDelete(p: Product) {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return
    try {
      await deleteProductMutation({ resource: 'productos', id: p.id })
      toast('Producto eliminado', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className={`bastion bastion-clay ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Productos</h1>
          <p className="page-subtitle">
            {products.length} producto{products.length !== 1 ? 's' : ''} registrado{products.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="Buscar por nombre o SKU…"
            className="input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <button onClick={() => setModal({ kind: 'create' })} className="btn-primary flex items-center gap-2">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo
          </button>
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <p>{search ? 'Sin resultados para esa búsqueda.' : 'No hay productos aún. ¡Creá el primero!'}</p>
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>SKU</th>
                <th>Precio base</th>
                <th>Stock</th>
                <th>Variantes</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className="table-cell-primary">{p.name}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.sku ?? '—'}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--bastion-sage)' }}>{fmt(p.basePrice)}</td>
                  <td className="mono" style={{ color: p.stockQuantity <= p.stockMinAlert ? 'var(--warning)' : 'var(--text-secondary)' }}>
                    {p.hasVariants ? '—' : p.stockQuantity}
                  </td>
                  <td>
                    {p.hasVariants ? (
                      <Link href={`/dashboard/productos/${p.id}/variantes`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>
                        Ver variantes →
                      </Link>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin variantes</span>
                    )}
                  </td>
                  <td><span className={p.active ? 'badge-confirmed' : 'badge-completed'}>{p.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div className="flex gap-1.5">
                      <button onClick={() => setModal({ kind: 'edit', product: p })} title="Editar" className="btn-mini btn-mini-neutral">Editar</button>
                      <button onClick={() => handleDelete(p)} title="Eliminar" className="btn-mini btn-mini-clay">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ProductModal
          mode={modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
