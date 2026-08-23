'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTable, useCreate, useUpdate, useDelete, useInvalidate } from '@refinedev/core'
import { extractErrorMessage, productsApi, wasteReasonsApi, companiesApi } from '@/lib/api'
import type { Product, CreateProductInput, UpdateProductInput, WasteReason, ProductType, CompanyLink } from '@/lib/types'
import { useToast } from '@/context/ToastContext'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Acento clay (POS_RESTAURANTE).

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

// basePrice admite '' mientras se tipea (18/08/2026, pedido del dueño: un
// campo de precio vacío no debería mostrar "0" a la fuerza -- forzarlo a 0
// en cada tecleo hacía que el campo "peleara" con quien lo estaba llenando).
// Se coerciona a number recién en handleSubmit.
type ProductFormState = Omit<CreateProductInput, 'basePrice'> & { basePrice: number | '' }

const EMPTY_CREATE: ProductFormState = {
  name: '',
  basePrice: '',
  description: null,
  sku: null,
  categoryId: null,
  hasVariants: false,
  stockQuantity: 0,
  stockMinAlert: 0,
  productType: 'RETAIL',
  assembleOnDemand: false,
}

const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  RAW_MATERIAL: 'Materia prima',
  RETAIL:       'Reventa (default)',
  COMPOSITE:    'Compuesto (tiene receta)',
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

  const [form, setForm] = useState<ProductFormState>(
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
          productType: mode.product.productType,
          assembleOnDemand: mode.product.assembleOnDemand,
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
          ? (value === '' ? '' : parseFloat(value))
          : value || null,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      // basePrice puede haber quedado '' (campo vacío) -- se coerciona a
      // number recién acá, no en cada tecleo (ver ProductFormState).
      const values: CreateProductInput = { ...form, basePrice: Number(form.basePrice) || 0 }
      if (isEdit) {
        const body: UpdateProductInput = values
        await updateProduct({ resource: 'productos', id: mode.product.id, values: body })
      } else {
        await createProduct({ resource: 'productos', values })
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="label" style={{ marginBottom: 0 }}>Tipo de producto</label>
            <select
              name="productType"
              className="input"
              value={form.productType ?? 'RETAIL'}
              onChange={e => setForm(f => ({ ...f, productType: e.target.value as ProductType }))}
            >
              {(Object.keys(PRODUCT_TYPE_LABEL) as ProductType[]).map(t => (
                <option key={t} value={t}>{PRODUCT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>

          {/* assemble_on_demand solo aplica a COMPOSITE (chk_products_assemble_on_demand en BD) */}
          {form.productType === 'COMPOSITE' && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                name="assembleOnDemand"
                checked={form.assembleOnDemand ?? false}
                onChange={handleChange}
                style={{ accentColor: 'var(--accent)', width: 16, height: 16, marginTop: 2 }}
              />
              <span>
                Armar en vivo al vender (sándwich)
                <br />
                <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                  Si no, necesita stock propio producido de antemano (pan congelado) — se carga con &quot;Producir&quot;.
                </span>
              </span>
            </label>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading || !form.name || Number(form.basePrice) < 0} className="btn-primary">
              {loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Registrar merma ────────────────────────────────────────────────────
// POST /api/products/stock/waste — solo para productos sin variantes acá
// (con variantes se registra por variante, en la subpágina de variantes).
function WasteModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [reasons, setReasons] = useState<WasteReason[]>([])
  const [reasonId, setReasonId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        setReasons(await wasteReasonsApi.list())
      } catch (err) {
        toast(extractErrorMessage(err), 'error')
      } finally {
        setLoading(false)
      }
    })
  }, [toast])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await productsApi.recordWaste({
        productId: product.id,
        quantity,
        wasteReasonId: reasonId,
        notes: notes.trim() || undefined,
      })
      toast('Merma registrada', 'success')
      onDone()
      onClose()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Registrar merma — {product.name}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Stock actual: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{product.stockQuantity}</span>
        </p>

        {loading ? (
          <div className="h-24 rounded-lg skeleton" />
        ) : reasons.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--warning)' }}>
            No hay motivos de merma cargados. Creá uno primero en la sección Motivos de Merma.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">Motivo</label>
              <select className="input" value={reasonId} onChange={e => setReasonId(e.target.value)} required>
                <option value="">Elegí un motivo…</option>
                {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cantidad</label>
              <input
                type="number" className="input" min={1} max={product.stockQuantity || undefined}
                value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} required
              />
            </div>
            <div>
              <label className="label">Notas <span style={{ color: 'var(--text-tertiary)' }}>(opcional)</span></label>
              <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones…" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={submitting || !reasonId} className="btn-danger">
                {submitting ? <span className="spinner" /> : null}
                Registrar merma
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Modal Registrar producción ────────────────────────────────────────────────
// POST /api/products/stock/production — solo para productos COMPOSITE con
// assembleOnDemand=false (necesitan stock propio producido de antemano).
// Explota la receta y descuenta cada componente + suma stock del producto.
function ProductionModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await productsApi.recordProduction({
        productId: product.id,
        quantity,
        notes: notes.trim() || undefined,
      })
      toast('Producción registrada', 'success')
      onDone()
      onClose()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Registrar producción — {product.name}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Stock actual: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{product.stockQuantity}</span> · descuenta cada
          componente de la receta según lo que tenga disponible.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Cantidad a producir</label>
            <input
              type="number" className="input" min={1}
              value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} required
            />
          </div>
          <div>
            <label className="label">Notas <span style={{ color: 'var(--text-tertiary)' }}>(opcional)</span></label>
            <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones…" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <span className="spinner" /> : null}
              Registrar producción
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Sección de un override (precio o receta) dentro del modal de vínculo —
// componente propio (no anidado) porque un componente creado en cada render
// del padre pierde su identidad y ESLint (react-hooks/static-components) lo
// marca error: React lo desmontaría/remontaría en cada re-render.
function OverrideSection({
  label, status, pendingLabel, activateLabel, busy, onActivate, onDeactivate, onAccept, onReject,
}: {
  label: string
  status: Product['priceOverrideStatus']
  pendingLabel: React.ReactNode
  activateLabel: string
  busy: string | null
  onActivate: () => void
  onDeactivate: () => void
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--surface-4)' }}>
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {status === 'PENDIENTE_DE_REVISION' ? (
        <>
          <p className="text-xs mb-2" style={{ color: 'var(--warning)' }}>
            La empresa actualizó el maestro mientras tu valor local estaba activo: {pendingLabel}
          </p>
          <div className="flex gap-2">
            <button onClick={onAccept} disabled={busy !== null} className="btn-mini btn-mini-sage">
              {busy === 'accept' ? '…' : 'Aceptar (usar el de la empresa)'}
            </button>
            <button onClick={onReject} disabled={busy !== null} className="btn-mini btn-mini-neutral">
              {busy === 'reject' ? '…' : 'Rechazar (quedarme con el mío)'}
            </button>
          </div>
        </>
      ) : status === 'ACTIVO' ? (
        <>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Usás un valor propio en esta sucursal, distinto del maestro.</p>
          <button onClick={onDeactivate} disabled={busy !== null} className="btn-mini btn-mini-neutral">
            {busy === 'deactivate' ? '…' : 'Volver a seguir a la empresa'}
          </button>
        </>
      ) : (
        <>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Sigue el valor que define la empresa.</p>
          <button onClick={onActivate} disabled={busy !== null} className="btn-mini btn-mini-neutral">
            {busy === 'activate' ? '…' : activateLabel}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Modal Vínculo de empresa ──────────────────────────────────────────────────
// Gestiona el override de precio Y de receta de un producto ya compartido
// (companyProductId !== null) — activar/desactivar override local, aceptar/
// rechazar una revisión pendiente (el maestro cambió mientras el override
// local estaba activo), y publicar el estado local actual como nuevo maestro.
function CompanyLinkModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [current, setCurrent] = useState(product)
  const [components, setComponents] = useState<Product[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(async () => {
      try { setComponents(await productsApi.list()) } catch { /* solo se usa para mostrar nombres, no bloquea */ }
    })
  }, [])

  function componentName(id: string) {
    return components.find(c => c.id === id)?.name ?? id
  }

  async function run(action: string, fn: () => Promise<Product | void>) {
    setBusy(action)
    try {
      const updated = await fn()
      if (updated) setCurrent(updated)
      onDone()
      toast('Listo', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handlePublish() {
    setBusy('publish')
    try {
      await productsApi.companyPublish(current.id)
      toast('Publicado como nuevo maestro de la empresa', 'success')
      onDone()
      onClose()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Vínculo de empresa — {current.name}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <OverrideSection
          label="Precio"
          status={current.priceOverrideStatus}
          activateLabel="Fijar precio propio"
          pendingLabel={current.pricePendingMasterValue !== null ? fmt(current.pricePendingMasterValue) : '—'}
          busy={busy}
          onActivate={() => run('activate', () => productsApi.priceOverride.activate(current.id))}
          onDeactivate={() => run('deactivate', () => productsApi.priceOverride.deactivate(current.id))}
          onAccept={() => run('accept', () => productsApi.priceOverride.accept(current.id))}
          onReject={() => run('reject', () => productsApi.priceOverride.reject(current.id))}
        />

        {current.productType === 'COMPOSITE' && (
          <OverrideSection
            label="Receta"
            status={current.recipeOverrideStatus}
            activateLabel="Fijar receta propia"
            pendingLabel={
              current.recipePendingMasterSnapshot?.length
                ? current.recipePendingMasterSnapshot.map(i => `${componentName(i.componentProductId)} × ${i.quantityPerUnit}`).join(', ')
                : '—'
            }
            busy={busy}
            onActivate={() => run('activate', () => productsApi.recipeOverride.activate(current.id))}
            onDeactivate={() => run('deactivate', () => productsApi.recipeOverride.deactivate(current.id))}
            onAccept={() => run('accept', () => productsApi.recipeOverride.accept(current.id))}
            onReject={() => run('reject', () => productsApi.recipeOverride.reject(current.id))}
          />
        )}

        <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Publicar sube el nombre/SKU actuales (y el precio, si no tenés override propio activo) como el nuevo maestro para todas las sucursales.
          </p>
          <button onClick={handlePublish} disabled={busy !== null} className="btn-secondary">
            {busy === 'publish' ? <span className="spinner" /> : null}
            Publicar cambios como maestro
          </button>
        </div>
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
  // recordWaste no pasa por el data provider (es una acción con nombre) —
  // invalidate() fuerza el refetch del stock después de registrar una merma.
  const invalidate = useInvalidate()

  const [modal, setModal] = useState<ModalMode | null>(null)
  const [wasteTarget, setWasteTarget] = useState<Product | null>(null)
  const [productionTarget, setProductionTarget] = useState<Product | null>(null)
  const [companyLinkTarget, setCompanyLinkTarget] = useState<Product | null>(null)
  const [companyLink, setCompanyLink] = useState<CompanyLink | null>(null)
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    queueMicrotask(async () => {
      try { setCompanyLink(await companiesApi.me()) } catch { /* no bloquea el resto de la pantalla */ }
    })
  }, [])

  async function handleDelete(p: Product) {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return
    try {
      await deleteProductMutation({ resource: 'productos', id: p.id })
      toast('Producto eliminado', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  async function handleShare(p: Product) {
    setSharingId(p.id)
    try {
      await productsApi.companyShare(p.id)
      toast('Producto compartido con la empresa', 'success')
      invalidate({ resource: 'productos', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSharingId(null)
    }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
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
                <th>Receta</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className="table-cell-primary">{p.name}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.sku ?? '—'}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(p.basePrice)}</td>
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
                  <td>
                    {p.productType === 'COMPOSITE' ? (
                      <Link href={`/dashboard/productos/${p.id}/receta`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>
                        Ver receta →
                      </Link>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                  <td><span className={p.active ? 'badge-confirmed' : 'badge-completed'}>{p.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div className="flex gap-1.5">
                      {!p.hasVariants && (
                        <button onClick={() => setWasteTarget(p)} title="Registrar merma" className="btn-mini btn-mini-neutral">Merma</button>
                      )}
                      {p.productType === 'COMPOSITE' && !p.assembleOnDemand && (
                        <button onClick={() => setProductionTarget(p)} title="Registrar producción" className="btn-mini btn-mini-sage">Producir</button>
                      )}
                      {companyLink?.companyId && !p.companyProductId && (
                        <button onClick={() => handleShare(p)} disabled={sharingId === p.id} title="Compartir con la empresa" className="btn-mini btn-mini-neutral">
                          {sharingId === p.id ? '…' : 'Compartir'}
                        </button>
                      )}
                      {p.companyProductId && (
                        <button onClick={() => setCompanyLinkTarget(p)} title="Vínculo de empresa" className="btn-mini btn-mini-neutral">
                          Vínculo
                          {(p.priceOverrideStatus === 'PENDIENTE_DE_REVISION' || p.recipeOverrideStatus === 'PENDIENTE_DE_REVISION') && (
                            <span title="Hay una revisión pendiente" style={{ marginLeft: 4, color: 'var(--warning)' }}>●</span>
                          )}
                        </button>
                      )}
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

      {/* Modal merma */}
      {wasteTarget && (
        <WasteModal
          product={wasteTarget}
          onClose={() => setWasteTarget(null)}
          onDone={() => invalidate({ resource: 'productos', invalidates: ['list'] })}
        />
      )}

      {/* Modal producción */}
      {productionTarget && (
        <ProductionModal
          product={productionTarget}
          onClose={() => setProductionTarget(null)}
          onDone={() => invalidate({ resource: 'productos', invalidates: ['list'] })}
        />
      )}

      {/* Modal vínculo de empresa */}
      {companyLinkTarget && (
        <CompanyLinkModal
          product={companyLinkTarget}
          onClose={() => setCompanyLinkTarget(null)}
          onDone={() => invalidate({ resource: 'productos', invalidates: ['list'] })}
        />
      )}
    </div>
  )
}
