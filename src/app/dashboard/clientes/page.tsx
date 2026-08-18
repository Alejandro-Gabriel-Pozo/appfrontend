'use client'
import { useState, useEffect, useMemo } from 'react'
import { useTable, useCreate, useUpdate, useInvalidate } from '@refinedev/core'
import { customersApi, customerRatesApi, resourcesApi, bookableServicesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Customer, CustomerRate, Resource, BookableService } from '@/lib/types'

const KIND_LABEL: Record<'INDIVIDUAL' | 'COMPANY', string> = {
  INDIVIDUAL: 'Individual',
  COMPANY: 'Empresa',
}

export default function ClientesPage() {
  const { toast } = useToast()
  const { result, tableQuery } = useTable<Customer>({ resource: 'clientes', pagination: { mode: 'off' } })
  const customers = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createCustomer } = useCreate<Customer>()
  const { mutateAsync: updateCustomer } = useUpdate<Customer>()
  // addTag/removeTag pegan directo a lib/api.ts (sub-recurso, no pasan por
  // el data provider) — invalidate() fuerza a useTable a refrescar después
  // igual que create/update lo hacen solos vía Refine.
  const invalidate = useInvalidate()
  const [search, setSearch] = useState('')

  // Crear cliente
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ fullName: '', email: '' })
  const [creating, setCreating] = useState(false)

  // Editar cliente (incluye tags)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [editForm, setEditForm] = useState({ displayName: '', kind: 'INDIVIDUAL' as 'INDIVIDUAL' | 'COMPANY', active: true })
  const [saving, setSaving] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [addingTag, setAddingTag] = useState(false)

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

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.trim().toLowerCase()
    return customers.filter(c =>
      c.fullName?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    )
  }, [customers, search])

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
      })
      setRates(customerRates)
      setRateForm({ targetType: 'resource', targetId: '', price: '', notes: '' })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Clientes</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gestión de clientes, tipo de cuenta y etiquetas</p>
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
          placeholder="Buscar por nombre o email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4" />
          </svg>
          <p className="text-slate-400 font-medium">{search ? 'Sin resultados para esa búsqueda' : 'Sin clientes todavía'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => openEdit(c)}>
                  <td className="px-4 py-3.5 font-medium text-white">{c.fullName}</td>
                  <td className="px-4 py-3.5 text-slate-300">{c.email}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                      {KIND_LABEL[c.kind ?? 'INDIVIDUAL']}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    {(c.active ?? true) ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">Activo</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400">Inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c) }} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors" aria-label="Editar">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={e => setEditForm(f => ({ ...f, active: e.target.checked }))}
                />
                Cliente activo
              </label>
              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? <span className="spinner" /> : null}
                Guardar cambios
              </button>
            </form>

            <div>
              <label className="label">Etiquetas</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {(editTarget.tags ?? []).length === 0 && (
                  <p className="text-xs text-slate-500">Sin etiquetas todavía.</p>
                )}
                {(editTarget.tags ?? []).map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-300"
                  >
                    {tag.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag.id)}
                      className="hover:text-white"
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

            <div>
              <label className="label">Tarifas especiales</label>
              <div className="space-y-2 mb-3">
                {rates.length === 0 && (
                  <p className="text-xs text-slate-500">Sin tarifas especiales — usa el precio de catálogo.</p>
                )}
                {rates.map(rate => (
                  <div key={rate.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-sm text-slate-200">
                      {rate.resourceId ? getResourceName(rate.resourceId) : getServiceName(rate.serviceId!)}
                      <span className="text-slate-500 text-xs ml-2">{rate.resourceId ? 'recurso' : 'servicio'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-emerald-400">${rate.price.toLocaleString('es-AR')}</span>
                      <button type="button" onClick={() => setRateToRemove(rate)} className="text-slate-500 hover:text-red-400" aria-label="Quitar tarifa especial">
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
