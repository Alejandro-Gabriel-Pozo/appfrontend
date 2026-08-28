'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTable, useCreate, useInvalidate } from '@refinedev/core'
import { extractErrorMessage, productsApi, wasteReasonsApi, consumptionDestinationsApi } from '@/lib/api'
import type { Product, CreateProductInput, WasteReason, ConsumptionDestination, ProductType } from '@/lib/types'
import { useToast } from '@/context/ToastContext'
import { useBusinessModules } from '@/hooks/useBusinessModules'

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
type ProductFormState = Omit<CreateProductInput, 'basePrice' | 'ivaRate' | 'arcaUnitCode'> & {
  basePrice: number | ''
  // '' es el mismo truco que basePrice para no forzar un valor mientras
  // se tipea -- acá el resting value es null (D8: vacío = hereda del
  // negocio), no 0.
  ivaRate: number | '' | null
  arcaUnitCode: number | '' | null
}

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
  ivaRate: null,
  unit: null,
  arcaUnitCode: null,
}

const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  RAW_MATERIAL: 'Materia prima',
  RETAIL:       'Reventa (default)',
  COMPOSITE:    'Compuesto (tiene receta)',
}

// ─── Modal Crear ──────────────────────────────────────────────────────────────
// Edición completa (nombre/precio/stock/tipo, vínculo de empresa, eliminar)
// vive en /dashboard/productos/[id] desde la migración de la auditoría de
// modales (25/08/2026) — este modal quedó solo para el alta.

function ProductModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const { mutateAsync: createProduct } = useCreate<Product>()
  const modules = useBusinessModules()

  const [form, setForm] = useState<ProductFormState>({ ...EMPTY_CREATE })
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
      // basePrice/ivaRate/arcaUnitCode pueden haber quedado '' (campo
      // vacío) -- se coercionan recién acá, no en cada tecleo (ver
      // ProductFormState). ivaRate/arcaUnitCode van a null (no a 0):
      // "vacío" es "hereda del negocio"/"sin código", no "cero".
      const values: CreateProductInput = {
        ...form,
        basePrice: Number(form.basePrice) || 0,
        ivaRate: form.ivaRate === '' || form.ivaRate == null ? null : Number(form.ivaRate),
        arcaUnitCode: form.arcaUnitCode === '' || form.arcaUnitCode == null ? null : Number(form.arcaUnitCode),
      }
      await createProduct({ resource: 'productos', values })
      toast('Producto creado', 'success')
      onClose()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }

  const field = (label: string, name: keyof CreateProductInput, type: string = 'text', required = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label className="label" style={{ marginBottom: 0 }}>{label}</label>
      <input
        name={name}
        type={type}
        className="input"
        required={required}
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
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Nuevo producto</h2>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {field('Nombre *', 'name', 'text', true)}
          {field('Precio base *', 'basePrice', 'number', true)}
          {/* 27/08/2026, auditoría de columnas obligatorias (docs/pendientes-2026-08-27.md):
              un producto sin SKU no debería poder existir -- ya lo exige
              CreateProductSchema (Zod) y products.sku (NOT NULL en la
              base); el asterisco + required acá evita el viaje redondo al
              servidor solo para descubrirlo. */}
          {field('SKU *', 'sku', 'text', true)}
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

          {(modules === null || modules['FACTURACION'] !== false) && (
            <details className="card" style={{ padding: 0 }}>
              <summary style={{ cursor: 'pointer', padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Datos fiscales (AFIP/ARCA)
              </summary>
              <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="label" style={{ marginBottom: 0 }}>IVA del producto (%) <span style={{ color: 'var(--text-tertiary)' }}>(opcional)</span></label>
                  <input
                    name="ivaRate" type="number" step="0.01" min={0} className="input"
                    value={form.ivaRate ?? ''} onChange={handleChange}
                    placeholder="Vacío = usa el IVA general del negocio"
                  />
                </div>
                <div>
                  <label className="label" style={{ marginBottom: 0 }}>Unidad <span style={{ color: 'var(--text-tertiary)' }}>(opcional)</span></label>
                  <input
                    name="unit" list="unit-suggestions-create" className="input"
                    value={form.unit ?? ''} onChange={handleChange}
                    placeholder="unidad, kg, litro…"
                  />
                  <datalist id="unit-suggestions-create">
                    <option value="unidad" /><option value="kg" /><option value="g" />
                    <option value="litro" /><option value="ml" /><option value="hora" />
                    <option value="m²" /><option value="docena" />
                  </datalist>
                </div>
                <div>
                  <label className="label" style={{ marginBottom: 0 }}>Código de unidad AFIP <span style={{ color: 'var(--text-tertiary)' }}>(opcional)</span></label>
                  <input
                    name="arcaUnitCode" type="number" step="1" className="input"
                    value={form.arcaUnitCode ?? ''} onChange={handleChange}
                    placeholder="Código numérico del catálogo Umed"
                  />
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
                    No se valida contra un catálogo todavía — confirmá el código correcto contra el SDK de ARCA antes de usarlo en un comprobante real.
                  </p>
                </div>
              </div>
            </details>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading || !form.name || Number(form.basePrice) < 0} className="btn-primary">
              {loading ? 'Guardando…' : 'Crear producto'}
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

// ─── Modal Registrar consumo interno ───────────────────────────────────────────
// 27/08/2026, pendientes-2026-08-27.md — gemelo exacto de WasteModal, adoptado
// de `proyecto script` (DESTINOS_CONSUMO). POST /api/products/stock/consumption
// — solo para productos sin variantes acá, mismo criterio que WasteModal.
function ConsumptionModal({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [destinations, setDestinations] = useState<ConsumptionDestination[]>([])
  const [destinationId, setDestinationId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        setDestinations(await consumptionDestinationsApi.list())
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
      await productsApi.recordConsumption({
        productId: product.id,
        quantity,
        consumptionDestinationId: destinationId,
        notes: notes.trim() || undefined,
      })
      toast('Consumo registrado', 'success')
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
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Registrar consumo — {product.name}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Stock actual: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{product.stockQuantity}</span>
        </p>

        {loading ? (
          <div className="h-24 rounded-lg skeleton" />
        ) : destinations.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--warning)' }}>
            No hay destinos de consumo cargados. Creá uno primero en la sección Destinos de Consumo.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">Destino</label>
              <select className="input" value={destinationId} onChange={e => setDestinationId(e.target.value)} required>
                <option value="">Elegí un destino…</option>
                {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
              <button type="submit" disabled={submitting || !destinationId} className="btn-primary">
                {submitting ? <span className="spinner" /> : null}
                Registrar consumo
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductosPage() {
  const router = useRouter()
  // Sin paginación server-side todavía (ver lib/refine/dataProvider.ts) —
  // pagination: { mode: 'off' } trae la lista completa tal cual la devuelve
  // productsApi.list(), sin que useTable intente paginarla por su cuenta.
  const { result, tableQuery } = useTable<Product>({ resource: 'productos', pagination: { mode: 'off' } })
  const products = result.data
  const loading = tableQuery.isLoading
  // recordWaste/recordProduction no pasan por el data provider (son
  // acciones con nombre) — invalidate() fuerza el refetch del stock después.
  const invalidate = useInvalidate()

  const [modal, setModal] = useState(false)
  const [wasteTarget, setWasteTarget] = useState<Product | null>(null)
  const [consumptionTarget, setConsumptionTarget] = useState<Product | null>(null)
  const [productionTarget, setProductionTarget] = useState<Product | null>(null)
  const [search, setSearch] = useState('')

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
          <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
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
                <tr key={p.id} onClick={() => router.push(`/dashboard/productos/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <td className="table-cell-primary">{p.name}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.sku ?? '—'}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(p.basePrice)}</td>
                  <td className="mono" style={{ color: p.stockQuantity <= p.stockMinAlert ? 'var(--warning)' : 'var(--text-secondary)' }}>
                    {p.hasVariants ? '—' : p.stockQuantity}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {p.hasVariants ? (
                      <Link href={`/dashboard/productos/${p.id}/variantes`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>
                        Ver variantes →
                      </Link>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin variantes</span>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    {p.productType === 'COMPOSITE' ? (
                      <Link href={`/dashboard/productos/${p.id}/receta`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>
                        Ver receta →
                      </Link>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={p.active ? 'badge-confirmed' : 'badge-completed'}>{p.active ? 'Activo' : 'Inactivo'}</span>
                    {(p.priceOverrideStatus === 'PENDIENTE_DE_REVISION' || p.recipeOverrideStatus === 'PENDIENTE_DE_REVISION') && (
                      <span title="Hay una revisión de vínculo de empresa pendiente" style={{ marginLeft: 6, color: 'var(--warning)' }}>●</span>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      {!p.hasVariants && (
                        <button onClick={() => setWasteTarget(p)} title="Registrar merma" className="btn-mini btn-mini-neutral">Merma</button>
                      )}
                      {!p.hasVariants && (
                        <button onClick={() => setConsumptionTarget(p)} title="Registrar consumo interno" className="btn-mini btn-mini-neutral">Consumo</button>
                      )}
                      {p.productType === 'COMPOSITE' && !p.assembleOnDemand && (
                        <button onClick={() => setProductionTarget(p)} title="Registrar producción" className="btn-mini btn-mini-sage">Producir</button>
                      )}
                      <Link href={`/dashboard/productos/${p.id}`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>Ver detalle</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && <ProductModal onClose={() => setModal(false)} />}

      {/* Modal merma */}
      {wasteTarget && (
        <WasteModal
          product={wasteTarget}
          onClose={() => setWasteTarget(null)}
          onDone={() => invalidate({ resource: 'productos', invalidates: ['list'] })}
        />
      )}

      {/* Modal consumo interno */}
      {consumptionTarget && (
        <ConsumptionModal
          product={consumptionTarget}
          onClose={() => setConsumptionTarget(null)}
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

    </div>
  )
}
