'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Modal from './Modal'
import { resourcesApi, resourceLocksApi, categoriesApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { BookableService, Resource, Category } from '@/lib/types'

interface ResourceLockPickerProps {
  open: boolean
  onClose: () => void
  service: BookableService
}

/**
 * Checkbox-list para elegir qué recursos físicos bloquea un servicio.
 * No existía ningún multi-select en el frontend antes de esto — todas las
 * relaciones FK usaban un <select> de un solo valor. Acá hace falta elegir
 * N recursos a la vez (ej. "Corte" bloquea la silla 1 Y la estilista Ana),
 * así que es un patrón nuevo: checkbox por fila, agrupado por categoría.
 */
export default function ResourceLockPicker({ open, onClose, service }: ResourceLockPickerProps) {
  const { toast } = useToast()
  const [resources, setResources] = useState<Resource[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [allResources, allCategories, locks] = await Promise.all([
        resourcesApi.list(),
        categoriesApi.list(),
        resourceLocksApi.list(service.id),
      ])
      setResources(allResources)
      setCategories(allCategories)
      setSelected(new Set(locks.map(l => l.resourceId)))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [service.id, toast])

  useEffect(() => { if (open) queueMicrotask(load) }, [open, load])

  function toggle(resourceId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(resourceId)) next.delete(resourceId)
      else next.add(resourceId)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await resourceLocksApi.replace(service.id, Array.from(selected))
      toast('Recursos bloqueados actualizados', 'success')
      onClose()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name ?? id

  // Agrupados por categoría para que sea escaneable si hay muchos recursos
  const grouped = useMemo(() => {
    const map = new Map<string, Resource[]>()
    for (const r of resources) {
      const list = map.get(r.categoryId) ?? []
      list.push(r)
      map.set(r.categoryId, list)
    }
    return Array.from(map.entries())
  }, [resources])

  return (
    <Modal open={open} onClose={onClose} title={`Recursos bloqueados — ${service.name}`} size="max-w-lg">
      <p className="text-xs text-slate-500 mb-4">
        Mientras dure una reserva de <span className="text-slate-300 font-medium">{service.name}</span>,
        los recursos marcados quedan ocupados — aunque no sean el recurso que eligió quien reserva.
      </p>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-slate-400 font-medium">Sin recursos todavía</p>
          <p className="text-slate-600 text-sm mt-1">Creá recursos físicos en la sección Recursos primero.</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
          {grouped.map(([categoryId, items]) => (
            <div key={categoryId}>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                {getCatName(categoryId)}
              </p>
              <div className="space-y-1.5">
                {items.map(r => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: 'var(--zulu-legacy-check-positive)' }}
                    />
                    <span className="text-sm text-slate-200">{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-5 mt-1 border-t border-white/[0.06]">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
        <button type="button" onClick={handleSave} disabled={saving || loading} className="btn-primary flex-1">
          {saving ? <span className="spinner" /> : null}
          Guardar
        </button>
      </div>
    </Modal>
  )
}
