'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUpdate, useDelete, useInvalidate } from '@refinedev/core'
import Link from 'next/link'
import { productsApi, companiesApi, extractErrorMessage } from '@/lib/api'
import { isApiError } from '@/lib/apiErrors'
import { useToast } from '@/context/ToastContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Product, CreateProductInput, UpdateProductInput, ProductType, CompanyLink } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Migrado de modales a ruta dedicada (auditoría UX de modales, 25/08/2026,
// docs/auditoria-modales.md) — "página canónica" que la auditoría pedía:
// antes existían /[id]/receta y /[id]/variantes pero ningún /[id] base.
// Reúne acá "Editar producto" (nombre/precio/stock/tipo) y "Vínculo de
// empresa" (override de precio/receta, publicar como maestro) — las dos
// piezas de la auditoría con más de 4 campos o relaciones. "Nuevo
// producto", "Merma" y "Producción" se quedan como modales en
// dashboard/productos/page.tsx: alta y acciones puntuales de 2-3 campos
// que no necesitan el contexto completo del producto (mismo criterio que
// "modal breve" del resto de las fases).

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

type ProductFormState = Omit<CreateProductInput, 'basePrice'> & { basePrice: number | '' }

const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  RAW_MATERIAL: 'Materia prima',
  RETAIL:       'Reventa (default)',
  COMPOSITE:    'Compuesto (tiene receta)',
}

// Componente propio (no anidado) — mismo motivo que en dashboard/productos/page.tsx:
// un componente creado en cada render del padre pierde su identidad y
// react-hooks/static-components lo marca error.
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

function Skeleton({ h = 20, w = '100%', radius = 8 }: { h?: number; w?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: radius }} />
}

export default function ProductoDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const { toast } = useToast()
  const { mutateAsync: updateProduct } = useUpdate<Product>()
  const { mutateAsync: deleteProductMutation } = useDelete<Product>()
  const invalidate = useInvalidate()

  const [product, setProduct] = useState<Product | null>(null)
  const [components, setComponents] = useState<Product[]>([])
  const [companyLink, setCompanyLink] = useState<CompanyLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState<ProductFormState | null>(null)
  const [saving, setSaving] = useState(false)

  const [busy, setBusy] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      const [p, comps, link] = await Promise.all([
        productsApi.get(id),
        productsApi.list(),
        companiesApi.me().catch(() => null),
      ])
      setProduct(p)
      setComponents(comps)
      setCompanyLink(link)
      setForm({
        name: p.name,
        basePrice: p.basePrice,
        description: p.description,
        sku: p.sku,
        categoryId: p.categoryId,
        hasVariants: p.hasVariants,
        stockQuantity: p.stockQuantity,
        stockMinAlert: p.stockMinAlert,
        productType: p.productType,
        assembleOnDemand: p.assembleOnDemand,
      })
    } catch (err) {
      if (isApiError(err) && err.code === 'PRODUCT_NOT_FOUND') {
        setNotFound(true)
      } else {
        toast(extractErrorMessage(err), 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  function componentName(componentId: string) {
    return components.find(c => c.id === componentId)?.name ?? componentId
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setForm(f => f && ({
      ...f,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
          ? (value === '' ? '' : parseFloat(value))
          : value || null,
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!product || !form) return
    setSaving(true)
    try {
      const body: UpdateProductInput = { ...form, basePrice: Number(form.basePrice) || 0 }
      const { data: updated } = await updateProduct({ resource: 'productos', id: product.id, values: body })
      toast('Producto actualizado', 'success')
      setProduct(updated)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function runOverride(action: string, fn: () => Promise<Product | void>) {
    setBusy(action)
    try {
      const updated = await fn()
      if (updated) setProduct(updated)
      invalidate({ resource: 'productos', invalidates: ['list'] })
      toast('Listo', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handlePublish() {
    if (!product) return
    setBusy('publish')
    try {
      await productsApi.companyPublish(product.id)
      toast('Publicado como nuevo maestro de la empresa', 'success')
      invalidate({ resource: 'productos', invalidates: ['list'] })
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function handleShare() {
    if (!product) return
    setSharing(true)
    try {
      await productsApi.companyShare(product.id)
      toast('Producto compartido con la empresa', 'success')
      invalidate({ resource: 'productos', invalidates: ['list'] })
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSharing(false)
    }
  }

  async function handleDelete() {
    if (!product) return
    setDeleting(true)
    try {
      await deleteProductMutation({ resource: 'productos', id: product.id })
      toast('Producto eliminado', 'success')
      router.push('/dashboard/productos')
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
          <Skeleton h={280} />
          <Skeleton h={140} />
        </div>
      </div>
    )
  }

  // ─── NOT FOUND ───────────────────────────────────────────────────────────
  if (notFound || !product || !form) {
    return (
      <div className="zulu" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
        <svg style={{ width: 48, height: 48, color: 'var(--text-tertiary)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Producto no encontrado</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>El ID ingresado no corresponde a ningún producto.</p>
        <Link href="/dashboard/productos" style={{ color: 'var(--accent)', fontSize: 14 }}>← Volver a Productos</Link>
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
            href="/dashboard/productos"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Productos
          </Link>
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{product.name}</h1>
          {product.sku && <p className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{product.sku}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {product.hasVariants && (
            <Link href={`/dashboard/productos/${product.id}/variantes`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>Ver variantes →</Link>
          )}
          {product.productType === 'COMPOSITE' && (
            <Link href={`/dashboard/productos/${product.id}/receta`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>Ver receta →</Link>
          )}
          <span className={product.active ? 'badge-confirmed' : 'badge-completed'}>{product.active ? 'Activo' : 'Inactivo'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* ── Información ── */}
        <div className="card">
          <div className="detail-card-header">Información</div>
          <div className="detail-card-body">
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Nombre *</label>
                <input name="name" className="input" value={form.name} onChange={handleFormChange} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Precio base *</label>
                  <input name="basePrice" type="number" step="0.01" className="input" value={form.basePrice} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="label">SKU</label>
                  <input name="sku" className="input" value={form.sku ?? ''} onChange={handleFormChange} />
                </div>
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea name="description" className="input" value={form.description ?? ''} onChange={handleFormChange} rows={2} style={{ resize: 'vertical' }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox" name="hasVariants" checked={form.hasVariants ?? false} onChange={handleFormChange}
                  style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
                />
                Tiene variantes (gestión de stock por variante)
              </label>

              {!form.hasVariants && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Stock actual</label>
                    <input name="stockQuantity" type="number" className="input" value={form.stockQuantity ?? 0} onChange={handleFormChange} />
                  </div>
                  <div>
                    <label className="label">Alerta mínima</label>
                    <input name="stockMinAlert" type="number" className="input" value={form.stockMinAlert ?? 0} onChange={handleFormChange} />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Tipo de producto</label>
                <select
                  name="productType" className="input" value={form.productType ?? 'RETAIL'}
                  onChange={e => setForm(f => f && ({ ...f, productType: e.target.value as ProductType }))}
                >
                  {(Object.keys(PRODUCT_TYPE_LABEL) as ProductType[]).map(t => (
                    <option key={t} value={t}>{PRODUCT_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </div>

              {form.productType === 'COMPOSITE' && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox" name="assembleOnDemand" checked={form.assembleOnDemand ?? false} onChange={handleFormChange}
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

              <button type="submit" disabled={saving || !form.name || Number(form.basePrice) < 0} className="btn-primary">
                {saving ? <span className="spinner" /> : null}
                Guardar cambios
              </button>
            </form>
          </div>
        </div>

        {/* ── Empresa ── */}
        <div className="card">
          <div className="detail-card-header">Empresa</div>
          <div className="detail-card-body">
            {!product.companyProductId ? (
              companyLink?.companyId ? (
                <>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Este producto todavía no se comparte con la empresa — otras sucursales no lo ven.
                  </p>
                  <button onClick={handleShare} disabled={sharing} className="btn-mini btn-mini-neutral">
                    {sharing ? '…' : 'Compartir con la empresa'}
                  </button>
                </>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Este negocio no pertenece a ninguna empresa multi-sucursal.</p>
              )
            ) : (
              <div className="space-y-3">
                <OverrideSection
                  label="Precio"
                  status={product.priceOverrideStatus}
                  activateLabel="Fijar precio propio"
                  pendingLabel={product.pricePendingMasterValue !== null ? fmt(product.pricePendingMasterValue) : '—'}
                  busy={busy}
                  onActivate={() => runOverride('activate', () => productsApi.priceOverride.activate(product.id))}
                  onDeactivate={() => runOverride('deactivate', () => productsApi.priceOverride.deactivate(product.id))}
                  onAccept={() => runOverride('accept', () => productsApi.priceOverride.accept(product.id))}
                  onReject={() => runOverride('reject', () => productsApi.priceOverride.reject(product.id))}
                />
                {product.productType === 'COMPOSITE' && (
                  <OverrideSection
                    label="Receta"
                    status={product.recipeOverrideStatus}
                    activateLabel="Fijar receta propia"
                    pendingLabel={
                      product.recipePendingMasterSnapshot?.length
                        ? product.recipePendingMasterSnapshot.map(i => `${componentName(i.componentProductId)} × ${i.quantityPerUnit}`).join(', ')
                        : '—'
                    }
                    busy={busy}
                    onActivate={() => runOverride('activate', () => productsApi.recipeOverride.activate(product.id))}
                    onDeactivate={() => runOverride('deactivate', () => productsApi.recipeOverride.deactivate(product.id))}
                    onAccept={() => runOverride('accept', () => productsApi.recipeOverride.accept(product.id))}
                    onReject={() => runOverride('reject', () => productsApi.recipeOverride.reject(product.id))}
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
            )}
          </div>
        </div>

        {/* ── Zona de riesgo ── */}
        <div className="card">
          <div className="detail-card-header">Eliminar</div>
          <div className="detail-card-body">
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Esta acción no se puede deshacer.</p>
            <button type="button" onClick={() => setConfirmDelete(true)} className="btn-mini btn-mini-clay">Eliminar producto</button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="¿Eliminar producto?"
        description={`Vas a eliminar "${product.name}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
