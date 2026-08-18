'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { productsApi, recipeItemsApi, extractErrorMessage } from '@/lib/api'
import type { Product, RecipeItem, CreateRecipeItemInput } from '@/lib/types'
import { useToast } from '@/context/ToastContext'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Acento clay (POS_RESTAURANTE, mismo módulo que Productos).
const fraunces = Fraunces({ subsets: ['latin'], weight: ['300', '500', '600'], variable: '--font-bastion-serif' })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-bastion-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-bastion-mono' })

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

const EMPTY: CreateRecipeItemInput = {
  componentProductId: '',
  quantityPerUnit: 1,
  costPerUnit: null,
  yieldPercentage: null,
}

// ─── Modal ───────────────────────────────────────────────────────────────────

type ModalMode = { kind: 'create' } | { kind: 'edit'; item: RecipeItem }

function RecipeItemModal({
  mode, productId, components, onClose, onSaved,
}: {
  mode: ModalMode
  productId: string
  components: Product[]
  onClose: () => void
  onSaved: (item: RecipeItem) => void
}) {
  const { toast } = useToast()
  const isEdit = mode.kind === 'edit'

  const [form, setForm] = useState<CreateRecipeItemInput>(
    isEdit
      ? {
          componentProductId: mode.item.componentProductId ?? '',
          quantityPerUnit: mode.item.quantityPerUnit,
          costPerUnit: mode.item.costPerUnit,
          yieldPercentage: mode.item.yieldPercentage,
        }
      : { ...EMPTY },
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      let saved: RecipeItem
      if (isEdit) {
        saved = await recipeItemsApi.update(productId, mode.item.id, {
          quantityPerUnit: form.quantityPerUnit,
          costPerUnit: form.costPerUnit,
          yieldPercentage: form.yieldPercentage,
        })
      } else {
        saved = await recipeItemsApi.create(productId, form)
      }
      onSaved(saved)
      toast(isEdit ? 'Ítem de receta actualizado' : 'Ítem agregado a la receta', 'success')
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
      <div className="card" style={{ width: '100%', maxWidth: 440, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
            {isEdit ? 'Editar ítem de receta' : 'Nuevo ítem de receta'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isEdit && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="label" style={{ marginBottom: 0 }}>Componente</label>
              <select
                className="input"
                value={form.componentProductId ?? ''}
                onChange={e => setForm(f => ({ ...f, componentProductId: e.target.value }))}
                required
              >
                <option value="">Elegí un producto…</option>
                {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Cantidad por unidad</label>
            <input
              type="number" className="input" min={0.001} step="0.001"
              value={form.quantityPerUnit} onChange={e => setForm(f => ({ ...f, quantityPerUnit: Number(e.target.value) }))} required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="label">Costo unitario <span style={{ color: 'var(--text-tertiary)' }}>(opc.)</span></label>
              <input
                type="number" className="input" min={0} step="0.01"
                value={form.costPerUnit ?? ''} onChange={e => setForm(f => ({ ...f, costPerUnit: e.target.value === '' ? null : Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="label">Rendimiento % <span style={{ color: 'var(--text-tertiary)' }}>(opc.)</span></label>
              <input
                type="number" className="input" min={0.01} max={100} step="0.01" placeholder="100"
                value={form.yieldPercentage ?? ''} onChange={e => setForm(f => ({ ...f, yieldPercentage: e.target.value === '' ? null : Number(e.target.value) }))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading || (!isEdit && !form.componentProductId)} className="btn-primary">
              {loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecetaPage() {
  const params = useParams()
  const productId = params?.id as string
  const { toast } = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [items, setItems] = useState<RecipeItem[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalMode | null>(null)

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      const [prod, recipeItems, products] = await Promise.all([
        productsApi.get(productId),
        recipeItemsApi.list(productId),
        productsApi.list(),
      ])
      setProduct(prod)
      setItems(recipeItems)
      setAllProducts(products)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [productId, toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  async function handleDelete(item: RecipeItem) {
    const comp = allProducts.find(p => p.id === item.componentProductId)
    if (!confirm(`¿Quitar "${comp?.name ?? item.componentProductId}" de la receta?`)) return
    try {
      await recipeItemsApi.remove(productId, item.id)
      toast('Ítem quitado de la receta', 'success')
      setItems(prev => prev.filter(x => x.id !== item.id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  function handleSaved(saved: RecipeItem) {
    setItems(prev => {
      const idx = prev.findIndex(x => x.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [saved, ...prev]
    })
  }

  function componentName(item: RecipeItem) {
    if (item.componentProductId) return allProducts.find(p => p.id === item.componentProductId)?.name ?? item.componentProductId
    return item.componentVariantId ?? '—'
  }

  // Componentes disponibles: cualquier producto activo, salvo el propio
  // (la receta ya no puede ser recursiva sobre sí misma — el backend además
  // valida ciclos multinivel con una CTE recursiva, esto es solo UX).
  const availableComponents = allProducts.filter(p => p.id !== productId && p.active)

  return (
    <div className={`bastion bastion-clay ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
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
            {product ? `Receta — ${product.name}` : 'Receta'}
          </h1>
          {product && (
            <p className="page-subtitle" style={{ marginTop: 0 }}>
              {product.assembleOnDemand
                ? 'Se arma en vivo al vender — no necesita stock propio.'
                : 'Necesita stock propio, cargado con "Producir" desde Productos.'}
              {' · '}{items.length} ítem{items.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button onClick={() => setModal({ kind: 'create' })} className="btn-primary flex items-center gap-2">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Agregar ítem
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg skeleton" />)}
        </div>
      ) : product && product.productType !== 'COMPOSITE' ? (
        <div className="card empty-state">
          <p>Este producto no está marcado como Compuesto — editalo en Productos y elegí el tipo &quot;Compuesto&quot; para poder cargarle una receta.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card empty-state">
          <p>Sin ítems todavía. Agregá el primer componente de la receta.</p>
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Componente</th>
                <th>Cantidad por unidad</th>
                <th>Costo unitario</th>
                <th>Rendimiento</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td className="table-cell-primary">{componentName(item)}</td>
                  <td className="mono">{item.quantityPerUnit}</td>
                  <td className="mono" style={{ color: 'var(--text-secondary)' }}>{item.costPerUnit !== null ? fmt(item.costPerUnit) : '—'}</td>
                  <td className="mono" style={{ color: 'var(--text-secondary)' }}>{item.yieldPercentage !== null ? `${item.yieldPercentage}%` : '100%'}</td>
                  <td>
                    <div className="flex gap-1.5">
                      <button onClick={() => setModal({ kind: 'edit', item })} className="btn-mini btn-mini-neutral">Editar</button>
                      <button onClick={() => handleDelete(item)} className="btn-mini btn-mini-clay">Quitar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <RecipeItemModal
          mode={modal}
          productId={productId}
          components={availableComponents}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
