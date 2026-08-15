'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { productsApi, variantsApi, extractErrorMessage } from '@/lib/api'
import type { Product, ProductVariant, CreateVariantInput, UpdateVariantInput } from '@/lib/types'
import { useToast } from '@/context/ToastContext'

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
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#13151e', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
        width: '100%', maxWidth: 460, padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>
            {isEdit ? 'Editar variante' : 'Nueva variante'}
          </h2>
          <button onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {[
            { label: 'Nombre *', name: 'name', type: 'text' },
            { label: 'SKU', name: 'sku', type: 'text' },
            { label: `Precio override (base: ${fmt(null, basePrice)})`, name: 'priceOverride', type: 'number' },
          ].map(({ label, name, type }) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
              <input
                name={name}
                type={type}
                value={(form[name as keyof CreateVariantInput] as string | number) ?? ''}
                onChange={handleChange}
                step={type === 'number' ? '0.01' : undefined}
                placeholder={name === 'priceOverride' ? 'Vacío = hereda del producto' : ''}
                style={{
                  padding: '8px 10px', borderRadius: 8,
                  background: '#1a1d28', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e4ea', fontSize: 13, outline: 'none',
                }}
              />
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Stock actual', name: 'stockQuantity' },
              { label: 'Alerta mínima', name: 'stockMinAlert' },
            ].map(({ label, name }) => (
              <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                <input
                  name={name}
                  type="number"
                  value={(form[name as keyof CreateVariantInput] as number) ?? 0}
                  onChange={handleChange}
                  min={0}
                  style={{
                    padding: '8px 10px', borderRadius: 8,
                    background: '#1a1d28', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e2e4ea', fontSize: 13, outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Atributos (JSON)
            </label>
            <textarea
              value={attrRaw}
              onChange={e => setAttrRaw(e.target.value)}
              rows={3}
              placeholder='{ "talle": "M", "color": "rojo" }'
              style={{
                padding: '8px 10px', borderRadius: 8,
                background: '#1a1d28', border: '1px solid rgba(255,255,255,0.1)',
                color: '#e2e4ea', fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'monospace',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}
            >Cancelar</button>
            <button type="submit" disabled={loading || !form.name}
              style={{ padding: '8px 16px', borderRadius: 8, background: '#10b981', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >{loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear variante'}</button>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back + Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link
            href="/dashboard/productos"
            style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Productos
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
            {product ? `Variantes — ${product.name}` : 'Variantes'}
          </h1>
          {product && (
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
              Precio base: <span style={{ color: '#10b981', fontWeight: 600 }}>
                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(product.basePrice)}
              </span>
              {' · '}{variants.length} variante{variants.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
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
          Nueva variante
        </button>
      </div>

      {/* Tabla */}
      <div style={{ background: '#13151e', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>Cargando…</div>
        ) : variants.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>
            No hay variantes aún. ¡Creá la primera!
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Nombre', 'SKU', 'Precio efectivo', 'Stock', 'Atributos', 'Estado', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr
                  key={v.id}
                  style={{ borderBottom: i < variants.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', transition: 'background 120ms' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#e2e4ea', fontWeight: 500 }}>{v.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{v.sku ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: v.priceOverride !== null ? '#a78bfa' : '#10b981', fontWeight: 600 }}>
                    {fmt(v.priceOverride, basePrice)}
                    {v.priceOverride !== null && (
                      <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 4 }}>(override)</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: v.stockQuantity <= v.stockMinAlert ? '#f59e0b' : '#9ca3af' }}>
                    {v.stockQuantity}
                    {v.stockQuantity <= v.stockMinAlert && v.stockMinAlert > 0 && (
                      <span title="Stock bajo mínimo" style={{ marginLeft: 4, color: '#f59e0b' }}>⚠</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#6b7280', fontFamily: 'monospace', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {Object.keys(v.attributes).length > 0
                      ? Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ')
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500,
                      background: v.active ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
                      color: v.active ? '#10b981' : '#6b7280',
                    }}>
                      {v.active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setModal({ kind: 'edit', variant: v })}
                        style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 11 }}
                      >Editar</button>
                      <button
                        onClick={() => handleDelete(v)}
                        style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}
                      >Eliminar</button>
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
