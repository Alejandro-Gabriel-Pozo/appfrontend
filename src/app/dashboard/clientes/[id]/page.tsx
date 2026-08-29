'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useUpdate, useInvalidate } from '@refinedev/core'
import Link from 'next/link'
import { customersApi, customerRatesApi, resourcesApi, bookableServicesApi, customerTaxProfileApi, padronApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { isApiError } from '@/lib/apiErrors'
import { useToast } from '@/context/ToastContext'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Customer, CustomerRate, Resource, BookableService, CustomerTaxProfile } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Sin módulo propio — acento brass por defecto (sección 6 del doc).
// Migrado de modal a ruta dedicada (auditoría UX de modales, 25/08/2026):
// el modal de edición reunía perfil, etiquetas, datos fiscales y tarifas
// especiales — demasiado para un overlay de 480px de ancho.

const KIND_LABEL: Record<'INDIVIDUAL' | 'COMPANY', string> = {
  INDIVIDUAL: 'Individual',
  COMPANY: 'Empresa',
}

function Skeleton({ h = 20, w = '100%', radius = 8 }: { h?: number; w?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: radius }} />
}

export default function ClienteDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { toast } = useToast()
  const { mutateAsync: updateCustomer } = useUpdate<Customer>()
  // addTag/removeTag pegan directo a lib/api.ts (sub-recurso, no pasan por
  // el data provider) — invalidate() fuerza a la lista a refrescar después,
  // igual que en la pantalla de listado.
  const invalidate = useInvalidate()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Editar datos básicos
  const [editForm, setEditForm] = useState({ displayName: '', kind: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY', active: true, enableCurrentAccount: false })
  const [saving, setSaving] = useState(false)

  // Etiquetas
  const [newTag, setNewTag] = useState('')
  const [addingTag, setAddingTag] = useState(false)

  // Datos fiscales (19/08/2026, auditoría de producto — padrón de ARCA)
  const [taxProfileEnabled, setTaxProfileEnabled] = useState(true)
  const [taxForm, setTaxForm] = useState({
    legalName: '', taxId: '', taxIdType: 'CUIT', taxCondition: '',
    addressLine1: '', addressCity: '', addressState: '', addressPostalCode: '', addressCountry: 'AR',
  })
  const [savingTaxProfile, setSavingTaxProfile] = useState(false)
  const [taxLookupInput, setTaxLookupInput] = useState('')
  const [lookingUpTax, setLookingUpTax] = useState(false)

  // Tarifas especiales
  const [resources, setResources] = useState<Resource[]>([])
  const [services, setServices] = useState<BookableService[]>([])
  const [rates, setRates] = useState<CustomerRate[]>([])
  const [rateForm, setRateForm] = useState({ targetType: 'resource' as 'resource' | 'service', targetId: '', price: '', notes: '' })
  const [addingRate, setAddingRate] = useState(false)
  const [rateToRemove, setRateToRemove] = useState<CustomerRate | null>(null)
  const [removingRate, setRemovingRate] = useState(false)

  function resetTaxForm(profile: CustomerTaxProfile | null) {
    setTaxForm({
      legalName: profile?.legalName ?? '',
      taxId: profile?.taxId ?? '',
      taxIdType: profile?.taxIdType ?? 'CUIT',
      taxCondition: profile?.taxCondition ?? '',
      addressLine1: profile?.address?.line1 ?? '',
      addressCity: profile?.address?.city ?? '',
      addressState: profile?.address?.state ?? '',
      addressPostalCode: profile?.address?.postalCode ?? '',
      addressCountry: profile?.address?.country ?? 'AR',
    })
    setTaxLookupInput('')
  }

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      const [full, customerRates, recs, svcs] = await Promise.all([
        customersApi.get(id),
        customerRatesApi.list(id),
        resourcesApi.list(),
        bookableServicesApi.list(),
      ])
      setCustomer(full)
      setEditForm({
        displayName: full.fullName,
        kind: full.kind ?? 'INDIVIDUAL',
        active: full.active ?? true,
        enableCurrentAccount: full.enableCurrentAccount ?? false,
      })
      setRates(customerRates)
      setResources(recs)
      setServices(svcs)
      setRateForm({ targetType: 'resource', targetId: '', price: '', notes: '' })

      // Datos fiscales — módulo aparte (Facturación). Un 402
      // MODULE_NOT_ENABLED es esperable si el negocio no lo tiene
      // habilitado, no un error real: se oculta la sección entera.
      try {
        const profile = await customerTaxProfileApi.get(full.id)
        setTaxProfileEnabled(true)
        resetTaxForm(profile)
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'MODULE_NOT_ENABLED') {
          setTaxProfileEnabled(false)
        } else {
          setTaxProfileEnabled(true)
          resetTaxForm(null)
          toast(extractErrorMessage(err), 'error')
        }
      }
    } catch (err) {
      if (isApiError(err) && err.code === 'CUSTOMER_NOT_FOUND') {
        setNotFound(true)
      } else {
        toast(extractErrorMessage(err), 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  async function handleSaveTaxProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return
    setSavingTaxProfile(true)
    try {
      const profile = await customerTaxProfileApi.upsert(customer.id, {
        legalName: taxForm.legalName,
        taxId: taxForm.taxId,
        taxIdType: taxForm.taxIdType,
        taxCondition: taxForm.taxCondition || null,
        address: taxForm.addressLine1
          ? {
              line1: taxForm.addressLine1,
              line2: null,
              city: taxForm.addressCity || null,
              state: taxForm.addressState || null,
              postalCode: taxForm.addressPostalCode || null,
              country: taxForm.addressCountry || 'AR',
            }
          : null,
      })
      resetTaxForm(profile)
      toast('Datos fiscales guardados', 'success')
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) toast(Object.values(fe)[0]!, 'error')
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSavingTaxProfile(false)
    }
  }

  /**
   * Campo único de búsqueda -- auto-detecta qué tipeó el usuario (pedido
   * del dueño, 23/08/2026, pendientes-2026-08-23.md): 11 dígitos (con o sin
   * guiones) es CUIT, 7-8 dígitos es DNI (resuelve DNI → CUIT → datos
   * completos del padrón en un solo click), cualquier otra cosa son letras
   * -- y buscar por razón social contra el padrón de ARCA no es posible:
   * los webservices ws_sr_padron_a5/a13 solo aceptan CUIT o DNI como clave,
   * no hay ningún método de búsqueda por nombre en el SDK (@arcasdk/core).
   */
  async function handleTaxLookup() {
    const raw = taxLookupInput.trim()
    if (!raw) return
    const digitsOnly = raw.replace(/-/g, '')

    if (!/^\d+$/.test(digitsOnly)) {
      toast('La búsqueda por razón social no está disponible en el padrón de ARCA — completá los datos a mano', 'error')
      return
    }

    setLookingUpTax(true)
    try {
      if (digitsOnly.length === 11) {
        const taxpayer = await padronApi.lookupByCuit(digitsOnly)
        if (!taxpayer) {
          toast('Ese CUIT no existe en el padrón de ARCA', 'error')
          return
        }
        applyTaxpayerLookup(taxpayer, taxpayer.cuit)
        toast('Datos completados desde el padrón de ARCA', 'success')
      } else if (digitsOnly.length === 7 || digitsOnly.length === 8) {
        const { cuit } = await padronApi.lookupByDni(digitsOnly)
        if (!cuit) {
          toast('Ese DNI no tiene ningún CUIT/CUIL asociado en el padrón de ARCA', 'error')
          return
        }
        const taxpayer = await padronApi.lookupByCuit(cuit)
        if (!taxpayer) {
          // Raro (el DNI sí resolvió a un CUIT) pero posible -- se completa
          // al menos el CUIT encontrado, el resto queda para completar a mano.
          setTaxForm(f => ({ ...f, taxId: cuit, taxIdType: 'CUIT' }))
          toast('Se encontró el CUIT pero no hay más datos en el padrón — completá el resto a mano', 'error')
          return
        }
        applyTaxpayerLookup(taxpayer, cuit)
        toast('Datos completados desde el padrón de ARCA', 'success')
      } else {
        toast('Ingresá un CUIT (11 dígitos) o un DNI (7-8 dígitos)', 'error')
      }
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLookingUpTax(false)
    }
  }

  function applyTaxpayerLookup(taxpayer: { legalName: string | null; taxCondition: 'MONOTRIBUTO' | 'REGIMEN_GENERAL' | null; address: { line1: string | null; city: string | null; state: string | null; postalCode: string | null; country: string } | null }, cuit: string) {
    setTaxForm(f => ({
      ...f,
      taxId: cuit,
      taxIdType: 'CUIT',
      ...(taxpayer.legalName && { legalName: taxpayer.legalName }),
      ...(taxpayer.taxCondition && { taxCondition: taxpayer.taxCondition === 'MONOTRIBUTO' ? 'Monotributo' : 'Responsable Inscripto' }),
      ...(taxpayer.address?.line1 && {
        addressLine1: taxpayer.address.line1,
        addressCity: taxpayer.address.city ?? f.addressCity,
        addressState: taxpayer.address.state ?? f.addressState,
        addressPostalCode: taxpayer.address.postalCode ?? f.addressPostalCode,
        addressCountry: taxpayer.address.country || 'AR',
      }),
    }))
  }

  async function handleAddRate(e: React.FormEvent) {
    e.preventDefault()
    if (!customer || !rateForm.targetId || !rateForm.price) return
    setAddingRate(true)
    try {
      const rate = await customerRatesApi.create(customer.id, {
        ...(rateForm.targetType === 'resource' ? { resourceId: rateForm.targetId } : { serviceId: rateForm.targetId }),
        price: parseFloat(rateForm.price),
        ...(rateForm.notes && { notes: rateForm.notes }),
      })
      setRates(r => [rate, ...r])
      setRateForm({ targetType: 'resource', targetId: '', price: '', notes: '' })
      toast('Tarifa especial creada', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setAddingRate(false)
    }
  }

  async function handleRemoveRate() {
    if (!customer || !rateToRemove) return
    setRemovingRate(true)
    try {
      await customerRatesApi.remove(customer.id, rateToRemove.id)
      setRates(r => r.filter(rt => rt.id !== rateToRemove.id))
      setRateToRemove(null)
      toast('Tarifa especial eliminada', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setRemovingRate(false)
    }
  }

  const getResourceName = (rid: string) => resources.find(r => r.id === rid)?.name ?? rid.slice(0, 8) + '…'
  const getServiceName = (sid: string) => services.find(s => s.id === sid)?.name ?? sid.slice(0, 8) + '…'

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return
    setSaving(true)
    try {
      const { data: updated } = await updateCustomer({ resource: 'clientes', id: customer.id, values: editForm })
      toast('Cliente actualizado', 'success')
      setCustomer(updated)
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) toast(Object.values(fe)[0]!, 'error')
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault()
    if (!customer || !newTag.trim()) return
    setAddingTag(true)
    try {
      const updated = await customersApi.addTag(customer.id, newTag.trim())
      setCustomer(updated)
      setNewTag('')
      invalidate({ resource: 'clientes', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setAddingTag(false)
    }
  }

  async function handleRemoveTag(tagId: string) {
    if (!customer) return
    try {
      await customersApi.removeTag(customer.id, tagId)
      setCustomer(c => c ? { ...c, tags: (c.tags ?? []).filter(tag => tag.id !== tagId) } : c)
      invalidate({ resource: 'clientes', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  // ─── LOADING ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="zulu" style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Skeleton h={16} w={80} />
          <Skeleton h={28} w={220} />
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <Skeleton h={160} />
          <Skeleton h={100} />
          <Skeleton h={200} />
        </div>
      </div>
    )
  }

  // ─── NOT FOUND ───────────────────────────────────────────────────────────
  if (notFound || !customer) {
    return (
      <div className="zulu" style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
        <svg style={{ width: 48, height: 48, color: 'var(--text-tertiary)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4" />
        </svg>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Cliente no encontrado</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>El ID ingresado no corresponde a ningún cliente.</p>
        <Link href="/dashboard/clientes" style={{ color: 'var(--zulu-link)', fontSize: 14 }}>← Volver a Clientes</Link>
      </div>
    )
  }

  return (
    <div className="zulu" style={{ maxWidth: 720, margin: '0 auto' }}>
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
            href="/dashboard/clientes"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Clientes
          </Link>
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{customer.fullName}</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{customer.email}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge-completed">{KIND_LABEL[customer.kind ?? 'INDIVIDUAL']}</span>
          {(customer.active ?? true) ? (
            <span className="badge-confirmed">Activo</span>
          ) : (
            <span className="badge-completed">Inactivo</span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* ── Información básica ── */}
        <div className="card">
          <div className="detail-card-header">Información básica</div>
          <div className="detail-card-body">
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Nombre completo</label>
                <input
                  className="input"
                  value={editForm.displayName}
                  onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="label">Tipo de cliente</label>
                <select
                  className="input"
                  value={editForm.kind}
                  onChange={e => setEditForm(f => ({ ...f, kind: e.target.value as 'INDIVIDUAL' | 'COMPANY' }))}
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="COMPANY">Empresa</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={e => setEditForm(f => ({ ...f, active: e.target.checked }))}
                  style={{ accentColor: 'var(--zulu-form-control)' }}
                />
                Cliente activo
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={editForm.enableCurrentAccount}
                  onChange={e => setEditForm(f => ({ ...f, enableCurrentAccount: e.target.checked }))}
                  style={{ accentColor: 'var(--zulu-form-control)' }}
                />
                Habilitar cuenta corriente
              </label>
              {editForm.enableCurrentAccount && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Este cliente va a aparecer en el panel de Cuentas Corrientes.
                </p>
              )}
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <span className="spinner" /> : null}
                Guardar cambios
              </button>
            </form>
          </div>
        </div>

        {/* ── Etiquetas ── */}
        <div className="card">
          <div className="detail-card-header">Etiquetas</div>
          <div className="detail-card-body">
            <div className="flex flex-wrap gap-2 mb-3">
              {(customer.tags ?? []).length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin etiquetas todavía.</p>
              )}
              {(customer.tags ?? []).map(tag => (
                <span key={tag.id} className="badge-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    aria-label={`Quitar etiqueta ${tag.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddTag} className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Ej: VIP, Corporativo…"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
              />
              <button type="submit" disabled={addingTag || !newTag.trim()} className="btn-secondary shrink-0">
                {addingTag ? <span className="spinner" /> : 'Agregar'}
              </button>
            </form>
          </div>
        </div>

        {/* ── Datos fiscales ── */}
        {taxProfileEnabled && (
          <div className="card">
            <div className="detail-card-header">Datos fiscales</div>
            <div className="detail-card-body">
              <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                CUIT, razón social y domicilio fiscal — necesarios para facturar a este cliente.
              </p>

              <div className="flex gap-2 mb-3">
                <input
                  className="input flex-1"
                  placeholder="CUIT o DNI para autocompletar desde ARCA…"
                  value={taxLookupInput}
                  onChange={e => setTaxLookupInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleTaxLookup}
                  disabled={lookingUpTax || !taxLookupInput.trim()}
                  className="btn-secondary shrink-0"
                >
                  {lookingUpTax ? <span className="spinner" /> : 'Buscar'}
                </button>
              </div>

              <form onSubmit={handleSaveTaxProfile} className="space-y-2">
                <div className="flex gap-2">
                  <select
                    className="input w-28 shrink-0"
                    value={taxForm.taxIdType}
                    onChange={e => setTaxForm(f => ({ ...f, taxIdType: e.target.value }))}
                  >
                    <option value="CUIT">CUIT</option>
                    <option value="CUIL">CUIL</option>
                    <option value="DNI">DNI</option>
                    <option value="OTRO">Otro</option>
                  </select>
                  <input
                    className="input flex-1"
                    placeholder="Número"
                    value={taxForm.taxId}
                    onChange={e => setTaxForm(f => ({ ...f, taxId: e.target.value }))}
                  />
                </div>
                <input
                  className="input w-full"
                  placeholder="Razón social / nombre completo"
                  value={taxForm.legalName}
                  onChange={e => setTaxForm(f => ({ ...f, legalName: e.target.value }))}
                />
                <input
                  className="input w-full"
                  placeholder="Condición frente al IVA (ej. Responsable Inscripto, Monotributo)"
                  value={taxForm.taxCondition}
                  onChange={e => setTaxForm(f => ({ ...f, taxCondition: e.target.value }))}
                />
                <input
                  className="input w-full"
                  placeholder="Domicilio fiscal"
                  value={taxForm.addressLine1}
                  onChange={e => setTaxForm(f => ({ ...f, addressLine1: e.target.value }))}
                />
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Localidad"
                    value={taxForm.addressCity}
                    onChange={e => setTaxForm(f => ({ ...f, addressCity: e.target.value }))}
                  />
                  <input
                    className="input flex-1"
                    placeholder="Provincia"
                    value={taxForm.addressState}
                    onChange={e => setTaxForm(f => ({ ...f, addressState: e.target.value }))}
                  />
                  <input
                    className="input w-28 shrink-0"
                    placeholder="CP"
                    value={taxForm.addressPostalCode}
                    onChange={e => setTaxForm(f => ({ ...f, addressPostalCode: e.target.value }))}
                  />
                </div>
                <button type="submit" disabled={savingTaxProfile || !taxForm.legalName.trim() || !taxForm.taxId.trim()} className="btn-primary w-full">
                  {savingTaxProfile ? <span className="spinner" /> : null}
                  Guardar datos fiscales
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Tarifas especiales ── */}
        <div className="card">
          <div className="detail-card-header">Tarifas especiales</div>
          <div className="detail-card-body">
            <div className="space-y-2 mb-3">
              {rates.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin tarifas especiales — usa el precio de catálogo.</p>
              )}
              {rates.map(rate => (
                <div key={rate.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--surface-4)', border: '1px solid var(--border)' }}>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {rate.resourceId ? getResourceName(rate.resourceId) : getServiceName(rate.serviceId!)}
                    <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>{rate.resourceId ? 'recurso' : 'servicio'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm mono" style={{ color: 'var(--success)' }}>${rate.price.toLocaleString('es-AR')}</span>
                    <button type="button" onClick={() => setRateToRemove(rate)} style={{ color: 'var(--text-tertiary)' }} aria-label="Quitar tarifa especial">
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddRate} className="space-y-2">
              <div className="flex gap-2">
                <select
                  className="input w-32 shrink-0"
                  value={rateForm.targetType}
                  onChange={e => setRateForm(f => ({ ...f, targetType: e.target.value as 'resource' | 'service', targetId: '' }))}
                >
                  <option value="resource">Recurso</option>
                  <option value="service">Servicio</option>
                </select>
                <select
                  className="input flex-1"
                  value={rateForm.targetId}
                  onChange={e => setRateForm(f => ({ ...f, targetId: e.target.value }))}
                >
                  <option value="">Seleccioná…</option>
                  {(rateForm.targetType === 'resource' ? resources : services).map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="input flex-1"
                  placeholder="Precio especial ($)"
                  value={rateForm.price}
                  onChange={e => setRateForm(f => ({ ...f, price: e.target.value }))}
                />
                <button type="submit" disabled={addingRate || !rateForm.targetId || !rateForm.price} className="btn-secondary shrink-0">
                  {addingRate ? <span className="spinner" /> : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Confirmar borrado de tarifa especial */}
      <ConfirmDialog
        open={rateToRemove !== null}
        onClose={() => setRateToRemove(null)}
        onConfirm={handleRemoveRate}
        title="¿Quitar tarifa especial?"
        description="El cliente vuelve a pagar el precio de catálogo para este recurso/servicio."
        confirmLabel="Quitar"
        variant="danger"
        loading={removingRate}
      />
    </div>
  )
}
