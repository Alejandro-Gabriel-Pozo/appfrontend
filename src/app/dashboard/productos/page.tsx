'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { productsApi, extractErrorMessage } from '@/lib/api'
import type { Product, CreateProductInput, UpdateProductInput } from '@/lib/types'
import { useToast } from '@/context/ToastContext'

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
  onSaved,
}: {
  mode: ModalMode
  onClose: () => void
  onSaved: (p: Product) => void
}) {
  const { toast } = useToast()
  const isEdit = mode.kind === 'edit'

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
      let saved: Product
      if (isEdit) {
        const body: UpdateProductInput = { ...form }
        saved = await productsApi.update(mode.product.id, body)
      } else {
        saved = await productsApi.create(form)
      }
      onSaved(saved)
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
      <label style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      <input
        name={name}
        type={type}
        value={type === 'checkbox' ? undefined : (form[name] as string | number) ?? ''}
        checked={type === 'checkbox' ? (form[name] as boolean) : undefined}
        onChange={handleChange}
        step={type === 'number' ? '0.01' : undefined}
        style={{
          padding: '8px 10px',
          borderRadius: 8,
          background: '#1a1d28',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#e2e4ea',
          fontSize: 13,
          outline: 'none',
          width: type === 'checkbox' ? undefined : '100%',
        }}
      />
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#13151e', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        width: '100%', maxWidth: 480,
        padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>
            {isEdit ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {field('Nombre *', 'name')}
          {field('Precio base *', 'basePrice', 'number')}
          {field('SKU', 'sku')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Descripción</label>
            <textarea
              name="description"
              value={form.description ?? ''}
              onChange={handleChange}
              rows={2}
              style={{
                padding: '8px 10px', borderRadius: 8,
                background: '#1a1d28', border: '1px solid rgba(255,255,255,0.1)',
                color: '#e2e4ea', fontSize: 13, outline: 'none', resize: 'vertical',
              }}
            />
          </div>

          {/* has_variants toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#e2e4ea' }}>
            <input
              type="checkbox"
              name="hasVariants"
              checked={form.hasVariants ?? false}
              onChange={handleChange}
              style={{ accentColor: '#10b981', width: 16, height: 16 }}
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
            <button
              type="button" onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}
            >Cancelar</button>
            <button
              type="submit" disabled={loading || !form.name || form.basePrice < 0}
              style={{ padding: '8px 16px', borderRadius: 8, background: '#10b981', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >{loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await productsApi.list()
      setProducts(data)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function handleDelete(p: Product) {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return
    try {
      await productsApi.remove(p.id)
      toast('Producto eliminado', 'success')
      setProducts(prev => prev.filter(x => x.id !== p.id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  function handleSaved(saved: Product) {
    setProducts(prev => {
      const idx = prev.findIndex(x => x.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [saved, ...prev]
    })
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Productos</h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
            {products.length} producto{products.length !== 1 ? 's' : ''} registrado{products.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="Buscar por nombre o SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 8,
              background: '#1a1d28', border: '1px solid rgba(255,255,255,0.1)',
              color: '#e2e4ea', fontSize: 13, outline: 'none', width: 220,
            }}
          />
          <button
            onClick={() => setModal({ kind: 'create' })}
            style={{
              padding: '8px 14px', borderRadius: 8, background: '#10b981',
              border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div style={{ background: '#13151e', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>
            {search ? 'Sin resultados para esa búsqueda.' : 'No hay productos aún. ¡Creá el primero!'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Nombre', 'SKU', 'Precio base', 'Stock', 'Variantes', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#e2e4ea', fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{p.sku ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#10b981', fontWeight: 600 }}>{fmt(p.basePrice)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: p.stockQuantity <= p.stockMinAlert ? '#f59e0b' : '#9ca3af' }}>
                    {p.hasVariants ? '—' : p.stockQuantity}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {p.hasVariants ? (
                      <Link
                        href={`/dashboard/productos/${p.id}/variantes`}
                        style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 20,
                          background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                          textDecoration: 'none', fontWeight: 500,
                        }}
                      >
                        Ver variantes →
                      </Link>
                    ) : (
                      <span style={{ fontSize: 11, color: '#4b5563' }}>Sin variantes</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500,
                      background: p.active ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
                      color: p.active ? '#10b981' : '#6b7280',
                    }}>
                      {p.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setModal({ kind: 'edit', product: p })}
                        title="Editar"
                        style={{
                          padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)',
                          border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 11,
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        title="Eliminar"
                        style={{
                          padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)',
                          border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11,
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ProductModal
          mode={modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
