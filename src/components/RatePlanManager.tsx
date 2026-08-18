'use client'
import { useState, useEffect, useCallback } from 'react'
import Modal from './Modal'
import { ratePlansApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { BookableService, RatePlan } from '@/lib/types'

interface RatePlanManagerProps {
  open: boolean
  onClose: () => void
  service: BookableService
}

const fmtMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format

// price admite '' mientras se tipea (mismo criterio que productos/recursos/
// servicios, 18/08/2026 -- ver ProductFormState en dashboard/productos/page.tsx).
type RatePlanFormState = { name: string; price: number | ''; includesBreakfast: boolean; cancellationPolicy: string; validFrom: string; validTo: string }
const EMPTY_FORM: RatePlanFormState = { name: '', price: '', includesBreakfast: false, cancellationPolicy: '', validFrom: '', validTo: '' }

/**
 * Gestión de tarifas de un servicio (18/08/2026, spec de mejoras PMS) — un
 * mismo `BookableService` puede tener varias `RatePlan` simultáneas (Rack,
 * Corporativa, No reembolsable). Integrado en la pantalla de Servicios
 * existente (botón "Tarifas" por fila) a propósito, no una pantalla nueva
 * -- el dato es una tabla separada de bookable_services (evita duplicar
 * resource_locks/horarios por variante de precio, ver pendientes-2026-08-
 * 18.md punto M), pero la UI no tiene por qué duplicarse solo porque el
 * dato es distinto.
 */
export default function RatePlanManager({ open, onClose, service }: RatePlanManagerProps) {
  const { toast } = useToast()
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<RatePlan | null>(null)
  const [form, setForm] = useState<RatePlanFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRatePlans(await ratePlansApi.list(service.id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [service.id, toast])

  useEffect(() => { if (open) queueMicrotask(load) }, [open, load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
  }

  function openEdit(rp: RatePlan) {
    setEditing(rp)
    setForm({
      name: rp.name, price: rp.price, includesBreakfast: rp.includesBreakfast,
      cancellationPolicy: rp.cancellationPolicy ?? '', validFrom: rp.validFrom ?? '', validTo: rp.validTo ?? '',
    })
    setFieldErrors({})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      const body = {
        name: form.name,
        price: Number(form.price) || 0,
        includesBreakfast: form.includesBreakfast,
        cancellationPolicy: form.cancellationPolicy || null,
        validFrom: form.validFrom || null,
        validTo: form.validTo || null,
      }
      if (editing) {
        await ratePlansApi.update(service.id, editing.id, body)
        toast('Tarifa actualizada', 'success')
      } else {
        await ratePlansApi.create(service.id, body)
        toast('Tarifa creada', 'success')
      }
      openCreate()
      await load()
    } catch (err) {
      const message = extractErrorMessage(err)
      if (message.toLowerCase().includes('validto') || message.toLowerCase().includes('valida')) {
        setFieldErrors({ validTo: message })
      } else if (message.toLowerCase().includes('ya existe')) {
        setFieldErrors({ name: message })
      } else {
        toast(message, 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate(rp: RatePlan) {
    try {
      await ratePlansApi.remove(service.id, rp.id)
      toast('Tarifa desactivada', 'success')
      if (editing?.id === rp.id) openCreate()
      await load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Tarifas — ${service.name}`} size="max-w-lg">
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        Varias tarifas pueden convivir para el mismo servicio (Rack, Corporativa, No reembolsable) —
        cada reserva elige una. La config del servicio (horarios, recursos) es una sola, no se repite por tarifa.
      </p>

      {loading ? (
        <div className="space-y-2 mb-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-10 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }} />)}
        </div>
      ) : ratePlans.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>Sin tarifas todavía — el servicio sigue usando su precio de catálogo (${service.price.toLocaleString('es-AR')}).</p>
      ) : (
        <div className="space-y-1.5 mb-4">
          {ratePlans.map(rp => (
            <div key={rp.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{rp.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {fmtMoney(rp.price)}
                  {rp.includesBreakfast && ' · con desayuno'}
                  {(rp.validFrom || rp.validTo) && ` · vigente ${rp.validFrom ?? '…'} a ${rp.validTo ?? '…'}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEdit(rp)} className="btn-mini btn-mini-neutral">Editar</button>
                <button onClick={() => handleDeactivate(rp)} className="btn-mini btn-mini-clay">Desactivar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>
          {editing ? `Editando "${editing.name}"` : 'Nueva tarifa'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Nombre</label>
            <input
              type="text" className="input" style={fieldErrors['name'] ? { borderColor: 'var(--danger)' } : undefined}
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
            />
            {fieldErrors['name'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['name']}</p>}
          </div>
          <div>
            <label className="label">Precio</label>
            <input
              type="number" className="input" min={0}
              value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value === '' ? '' : parseFloat(e.target.value) }))} required
            />
          </div>
          <div>
            <label className="label">Vigente desde</label>
            <input type="date" className="input" value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} />
          </div>
          <div>
            <label className="label">Vigente hasta</label>
            <input
              type="date" className="input" style={fieldErrors['validTo'] ? { borderColor: 'var(--danger)' } : undefined}
              value={form.validTo} onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))}
            />
            {fieldErrors['validTo'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['validTo']}</p>}
          </div>
        </div>
        <div>
          <label className="label">Política de cancelación (opcional)</label>
          <textarea className="input" rows={2} value={form.cancellationPolicy} onChange={e => setForm(f => ({ ...f, cancellationPolicy: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={form.includesBreakfast} onChange={e => setForm(f => ({ ...f, includesBreakfast: e.target.checked }))} />
          Incluye desayuno
        </label>
        <div className="flex gap-2 pt-1">
          {editing && (
            <button type="button" onClick={openCreate} className="btn-secondary">Cancelar edición</button>
          )}
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear tarifa'}
          </button>
        </div>
      </form>

      <div className="flex justify-end pt-4 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
        <button type="button" onClick={onClose} className="btn-secondary">Cerrar</button>
      </div>
    </Modal>
  )
}
