'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { productsApi, variantsApi, extractErrorMessage } from '@/lib/api'
import type { Product, ProductVariant, CreateVariantInput, UpdateVariantInput } from '@/lib/types'
import { useToast } from '@/context/ToastContext'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Acento clay (POS_RESTAURANTE, mismo módulo que Productos).

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, base: number) {
  const val = n ?? base
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val)
}

const EMPTY: CreateVariantInput = {
  name: '',
  sku: null,
  priceOverride: null,
  stockQuantity: 0,
  stockMinAlert: 0,
  attributes: {},
}

// ─── Modal ───────────────────────────────────────────────────────────────────

type ModalMode = { kind: 'create' } | { kind: 'edit'; variant: ProductVariant }

function VariantModal({
  mode,
  productId,
  basePrice,
  onClose,
  onSaved,
}: {
  mode: ModalMode
  productId: string
  basePrice: number
  onClose: () => void
  onSaved: (v: ProductVariant) => void
}) {
  const { toast } = useToast()
  const isEdit = mode.kind === 'edit'

  const [form, setForm] = useState<CreateVariantInput>(
    isEdit
      ? {
          name: mode.variant.name,
          sku: mode.variant.sku,
          priceOverride: mode.variant.priceOverride,
          stockQuantity: mode.variant.stockQuantity,
          stockMinAlert: mode.variant.stockMinAlert,
          attributes: mode.variant.attributes,
        }
      : { ...EMPTY },
  )
  const [attrRaw, setAttrRaw] = useState(
    isEdit ? JSON.stringify(mode.variant.attributes, null, 2) : '{}',
  )
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type } = e.target
    setForm(f => ({
      ...f,
      [name]: type === 'number' ? (value === '' ? null : parseFloat(value)) : (value || null),
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let parsedAttrs: Record<string, string> = {}
    try { parsedAttrs = JSON.parse(attrRaw) } catch { toast('JSON de atributos inválido', 'error'); return }
    setLoading(true)
    try {
      const payload = { ...form, attributes: parsedAttrs }
      let saved: ProductVariant
      if (isEdit) {
        const body: UpdateVariantInput = { ...payload }
        saved = await variantsApi.update(productId, mode.variant.id, body)
      } else {
        saved = await variantsApi.create(productId, payload as CreateVariantInput)
      }
      onSaved(saved)
      toast(isEdit ? 'Variante actualizada' : 'Variante creada', 'success')
      onClose()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            {isEdit ? 'Editar variante' : 'Nueva variante'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {[
            { label: 'Nombre *', name: 'name', type: 'text' },
            { label: 'SKU', name: 'sku', type: 'text' },
            { label: `Precio override (base: ${fmt(null, basePrice)})`, name: 'priceOverride', type: 'number' },
          ].map(({ label, name, type }) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="label" style={{ marginBottom: 0 }}>{label}</label>
              <input
                name={name}
                type={type}
                className="input"
                value={(form[name as keyof CreateVariantInput] as string | number) ?? ''}
                onChange={handleChange}
                step={type === 'number' ? '0.01' : undefined}
                placeholder={name === 'priceOverride' ? 'Vacío = hereda del producto' : ''}
              />
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Stock actual', name: 'stockQuantity' },
              { label: 'Alerta mínima', name: 'stockMinAlert' },
            ].map(({ label, name }) => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="label" style={{ marginBottom: 0 }}>{label}</label>
                <input
                  name={name}
                  type="number"
                  className="input"
                  value={(form[name as keyof CreateVariantInput] as number) ?? 0}
                  onChange={handleChange}
                  min={0}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>Atributos (JSON)</label>
            <textarea
              className="input mono"
              value={attrRaw}
              onChange={e => setAttrRaw(e.target.value)}
              rows={3}
              placeholder='{ "talle": "M", "color": "rojo" }'
              style={{ fontSize: 12, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading || !form.name} className="btn-primary">
              {loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear variante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VariantesPage() {
  const params = useParams()
  const productId = params?.id as string
  const { toast } = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalMode | null>(null)

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      const [prod, vars] = await Promise.all([
        productsApi.get(productId),
        variantsApi.list(productId),
      ])
      setProduct(prod)
      setVariants(vars)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [productId, toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  async function handleDelete(v: ProductVariant) {
    if (!confirm(`¿Eliminar variante "${v.name}"?`)) return
    try {
      await variantsApi.remove(productId, v.id)
      toast('Variante eliminada', 'success')
      setVariants(prev => prev.filter(x => x.id !== v.id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  function handleSaved(saved: ProductVariant) {
    setVariants(prev => {
      const idx = prev.findIndex(x => x.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [saved, ...prev]
    })
  }

  const basePrice = product?.basePrice ?? 0

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      {/* Back + Header */}
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link
            href="/dashboard/productos"
            style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Productos
          </Link>
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 600 }}>
            {product ? `Variantes — ${product.name}` : 'Variantes'}
          </h1>
          {product && (
            <p className="page-subtitle" style={{ marginTop: 0 }}>
              Precio base: <span className="mono" style={{ color: 'var(--success)', fontWeight: 600 }}>
                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(product.basePrice)}
              </span>
              {' · '}{variants.length} variante{variants.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button onClick={() => setModal({ kind: 'create' })} className="btn-primary flex items-center gap-2">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nueva variante
        </button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-lg skeleton" />)}
        </div>
      ) : variants.length === 0 ? (
        <div className="card empty-state">
          <p>No hay variantes aún. ¡Creá la primera!</p>
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>SKU</th>
                <th>Precio efectivo</th>
                <th>Stock</th>
                <th>Atributos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <tr key={v.id}>
                  <td className="table-cell-primary">{v.name}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{v.sku ?? '—'}</td>
                  <td className="mono" style={{ fontWeight: 600, color: v.priceOverride !== null ? 'var(--accent)' : 'var(--success)' }}>
                    {fmt(v.priceOverride, basePrice)}
                    {v.priceOverride !== null && (
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>(override)</span>
                    )}
                  </td>
                  <td className="mono" style={{ color: v.stockQuantity <= v.stockMinAlert ? 'var(--warning)' : 'var(--text-secondary)' }}>
                    {v.stockQuantity}
                    {v.stockQuantity <= v.stockMinAlert && v.stockMinAlert > 0 && (
                      <span title="Stock bajo mínimo" style={{ marginLeft: 4 }}>⚠</span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {Object.keys(v.attributes).length > 0
                      ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ')
                      : '—'}
                  </td>
                  <td><span className={v.active ? 'badge-confirmed' : 'badge-completed'}>{v.active ? 'Activa' : 'Inactiva'}</span></td>
                  <td>
                    <div className="flex gap-1.5">
                      <button onClick={() => setModal({ kind: 'edit', variant: v })} className="btn-mini btn-mini-neutral">Editar</button>
                      <button onClick={() => handleDelete(v)} className="btn-mini btn-mini-clay">Eliminar</button>
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
        <VariantModal
          mode={modal}
          productId={productId}
          basePrice={basePrice}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
