'use client'
import { useState, useEffect } from 'react'
import { useTable, useCreate, useUpdate, useInvalidate } from '@refinedev/core'
import { customersApi, customerRatesApi, resourcesApi, bookableServicesApi, customerTaxProfileApi, padronApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Customer, CustomerRate, Resource, BookableService, CustomerTaxProfile } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Sin módulo propio — acento brass por defecto (sección 6 del doc).

const KIND_LABEL: Record<'INDIVIDUAL' | 'COMPANY', string> = {
  INDIVIDUAL: 'Individual',
  COMPANY: 'Empresa',
}

export default function ClientesPage() {
  const { toast } = useToast()
  const {
    result, tableQuery,
    currentPage, setCurrentPage, pageCount,
    setFilters,
  } = useTable<Customer>({ resource: 'clientes', pagination: { mode: 'server', pageSize: 20 } })
  const customers = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createCustomer } = useCreate<Customer>()
  const { mutateAsync: updateCustomer } = useUpdate<Customer>()
  // addTag/removeTag pegan directo a lib/api.ts (sub-recurso, no pasan por
  // el data provider) — invalidate() fuerza a useTable a refrescar después
  // igual que create/update lo hacen solos vía Refine.
  const invalidate = useInvalidate()
  const [search, setSearch] = useState('')
  // G1 (23/08/2026) — si lo que se tipeó son solo dígitos (7+, forma de un
  // CUIT/DNI), se busca contra customer_tax_profiles en el backend en vez
  // de filtrar por nombre/email en memoria -- el CUIT/DNI de un cliente no
  // viaja en la lista que ya se cargó, hay que pedirlo aparte.
  const [taxIdMatches, setTaxIdMatches] = useState<Customer[] | null>(null)

  // Crear cliente
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ fullName: '', email: '' })
  const [creating, setCreating] = useState(false)

  // Editar cliente (incluye tags)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [editForm, setEditForm] = useState({ displayName: '', kind: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY', active: true, enableCurrentAccount: false })
  const [saving, setSaving] = useState(false)
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

  // Recursos/servicios no están migrados a esta pantalla (son para el picker
  // de tarifas especiales) — se siguen trayendo directo, igual que antes.
  useEffect(() => {
    queueMicrotask(() => {
      Promise.all([resourcesApi.list(), bookableServicesApi.list()])
        .then(([recs, svcs]) => { setResources(recs); setServices(svcs) })
        .catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

  // K2 (23/08/2026) — Clientes pasó a paginación server-side. El buscador
  // sigue siendo un único campo, con dos caminos server-side distintos
  // (mismo debounce de 400ms de siempre, un solo efecto):
  // - 7+ dígitos → CUIT/DNI, va a customers_tax_profiles (G1, exacto).
  // - lo demás → filtro `search` (nombre O email) de GET /customers, ya
  //   soportado por el backend (customer.repository.ts).
  useEffect(() => {
    const digitsOnly = search.trim().replace(/[-\s.]/g, '')
    const looksLikeTaxId = digitsOnly.length >= 7 && /^\d+$/.test(digitsOnly)
    const timer = setTimeout(() => {
      setCurrentPage(1)
      if (looksLikeTaxId) {
        customersApi.searchByTaxId(digitsOnly)
          .then(setTaxIdMatches)
          .catch(err => toast(extractErrorMessage(err), 'error'))
        setFilters([{ field: 'search', operator: 'contains', value: undefined }])
      } else {
        setTaxIdMatches(null)
        setFilters([{ field: 'search', operator: 'contains', value: search.trim() || undefined }])
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [search, toast, setCurrentPage, setFilters])

  // Con paginación server-side, `customers` ya viene filtrado por el
  // backend (search) — acá solo se elige entre esa página y los matches
  // exactos de CUIT/DNI (que no paginan, son unos pocos resultados).
  const filtered = taxIdMatches !== null ? taxIdMatches : customers

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await createCustomer({ resource: 'clientes', values: createForm })
      toast('Cliente creado', 'success')
      setCreateOpen(false)
      setCreateForm({ fullName: '', email: '' })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setCreating(false)
    }
  }

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

  async function openEdit(c: Customer) {
    // GET /:id trae los tags — la lista no los incluye para no hacer N+1.
    try {
      const [full, customerRates] = await Promise.all([
        customersApi.get(c.id),
        customerRatesApi.list(c.id),
      ])
      setEditTarget(full)
      setEditForm({
        displayName: full.fullName,
        kind: full.kind ?? 'INDIVIDUAL',
        active: full.active ?? true,
        enableCurrentAccount: full.enableCurrentAccount ?? false,
      })
      setRates(customerRates)
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
      toast(extractErrorMessage(err), 'error')
    }
  }

  async function handleSaveTaxProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setSavingTaxProfile(true)
    try {
      const profile = await customerTaxProfileApi.upsert(editTarget.id, {
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
    if (!editTarget || !rateForm.targetId || !rateForm.price) return
    setAddingRate(true)
    try {
      const rate = await customerRatesApi.create(editTarget.id, {
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
    if (!editTarget || !rateToRemove) return
    setRemovingRate(true)
    try {
      await customerRatesApi.remove(editTarget.id, rateToRemove.id)
      setRates(r => r.filter(rt => rt.id !== rateToRemove.id))
      setRateToRemove(null)
      toast('Tarifa especial eliminada', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setRemovingRate(false)
    }
  }

  const getResourceName = (id: string) => resources.find(r => r.id === id)?.name ?? id.slice(0, 8) + '…'
  const getServiceName = (id: string) => services.find(s => s.id === id)?.name ?? id.slice(0, 8) + '…'

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    try {
      const { data: updated } = await updateCustomer({ resource: 'clientes', id: editTarget.id, values: editForm })
      toast('Cliente actualizado', 'success')
      setEditTarget(updated)
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
    if (!editTarget || !newTag.trim()) return
    setAddingTag(true)
    try {
      const updated = await customersApi.addTag(editTarget.id, newTag.trim())
      setEditTarget(updated)
      setNewTag('')
      invalidate({ resource: 'clientes', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setAddingTag(false)
    }
  }

  async function handleRemoveTag(tagId: string) {
    if (!editTarget) return
    try {
      await customersApi.removeTag(editTarget.id, tagId)
      setEditTarget(t => t ? { ...t, tags: (t.tags ?? []).filter(tag => tag.id !== tagId) } : t)
      invalidate({ resource: 'clientes', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Clientes</h1>
          <p className="page-subtitle">Gestión de clientes, tipo de cuenta y etiquetas</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cliente
        </button>
      </div>

      <div className="mb-4">
        <input
          type="search"
          className="input w-full max-w-xs"
          placeholder="Buscar por nombre, email o CUIT/DNI…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4" />
          </svg>
          <p>{search ? 'Sin resultados para esa búsqueda' : 'Sin clientes todavía'}</p>
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(c)}>
                  <td className="table-cell-primary">{c.fullName}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{c.email}</td>
                  <td><span className="badge-completed">{KIND_LABEL[c.kind ?? 'INDIVIDUAL']}</span></td>
                  <td>
                    {(c.active ?? true) ? (
                      <span className="badge-confirmed">Activo</span>
                    ) : (
                      <span className="badge-completed">Inactivo</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(c)} className="btn-mini btn-mini-neutral">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación — la búsqueda por CUIT/DNI no pagina (son unos pocos matches exactos) */}
      {taxIdMatches === null && pageCount > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span style={{ color: 'var(--text-tertiary)' }}>
            {result.total ?? filtered.length} resultado{(result.total ?? filtered.length) !== 1 ? 's' : ''} · página {currentPage} de {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-secondary"
              style={{ padding: '6px 12px' }}
            >
              ← Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="btn-secondary"
              style={{ padding: '6px 12px' }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Modal nuevo cliente */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo cliente">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Nombre completo</label>
            <input className="input" value={createForm.fullName} onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Juan García" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="juan@email.com" required />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={creating} className="btn-primary flex-1">
              {creating ? <span className="spinner" /> : null}
              Crear cliente
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal editar cliente (datos + tags) */}
      <Modal open={editTarget !== null} onClose={() => setEditTarget(null)} title="Editar cliente">
        {editTarget && (
          <div className="space-y-6">
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
                  style={{ accentColor: 'var(--accent)' }}
                />
                Cliente activo
              </label>
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={editForm.enableCurrentAccount}
                  onChange={e => setEditForm(f => ({ ...f, enableCurrentAccount: e.target.checked }))}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Habilitar cuenta corriente
              </label>
              {editForm.enableCurrentAccount && (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Este cliente va a aparecer en el panel de Cuentas Corrientes.
                </p>
              )}
              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? <span className="spinner" /> : null}
                Guardar cambios
              </button>
            </form>

            <div>
              <label className="label">Etiquetas</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {(editTarget.tags ?? []).length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin etiquetas todavía.</p>
                )}
                {(editTarget.tags ?? []).map(tag => (
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

            {taxProfileEnabled && (
              <div>
                <label className="label">Datos fiscales</label>
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
            )}

            <div>
              <label className="label">Tarifas especiales</label>
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
        )}
      </Modal>

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
