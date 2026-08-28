'use client'
import { useState } from 'react'
import { useTable, useCreate, useUpdate, useDelete } from '@refinedev/core'
import { extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { ConsumptionDestination } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Acento clay (POS_RESTAURANTE) — mismo módulo que Productos/Órdenes.
//
// 27/08/2026, pendientes-2026-08-27.md — gemelo exacto de
// dashboard/motivos-merma/page.tsx (adoptado de `proyecto script`,
// DESTINOS_CONSUMO). Comida de personal, degustación, elaboración interna
// son COSTO OPERATIVO, no pérdida — catálogo propio para no distorsionar el
// reporte de mermas.

export default function DestinosConsumoPage() {
  const { toast } = useToast()
  const { result, tableQuery } = useTable<ConsumptionDestination>({ resource: 'destinos-consumo', pagination: { mode: 'off' } })
  const destinations = result.data
  const loading = tableQuery.isLoading

  const { mutateAsync: createDestination } = useCreate<ConsumptionDestination>()
  const { mutateAsync: updateDestination } = useUpdate<ConsumptionDestination>()
  const { mutateAsync: deleteDestinationMutation } = useDelete<ConsumptionDestination>()

  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<ConsumptionDestination | null>(null)
  const [name, setName]             = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ConsumptionDestination | null>(null)

  function openCreate() {
    setEditing(null)
    setName('')
    setModalOpen(true)
  }

  function openEdit(d: ConsumptionDestination) {
    setEditing(d)
    setName(d.name)
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editing) {
        await updateDestination({ resource: 'destinos-consumo', id: editing.id, values: { name } })
        toast('Destino actualizado', 'success')
      } else {
        await createDestination({ resource: 'destinos-consumo', values: { name } })
        toast('Destino creado', 'success')
      }
      setModalOpen(false)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteDestinationMutation({ resource: 'destinos-consumo', id: deleteTarget.id })
      toast('Destino eliminado', 'success')
      setDeleteTarget(null)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    }
  }

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Destinos de Consumo</h1>
          <p className="page-subtitle">Catálogo de destinos para registrar consumo interno (personal, degustación, elaboración interna…) — no es merma</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo destino
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg skeleton" />)}
        </div>
      ) : destinations.length === 0 ? (
        <div className="card empty-state">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <h3>Sin destinos todavía</h3>
          <p>Creá el primero con el botón de arriba — lo vas a necesitar para registrar cualquier consumo interno</p>
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {destinations.map(d => (
                <tr key={d.id}>
                  <td className="table-cell-primary">{d.name}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(d)} className="btn-mini btn-mini-neutral">Editar</button>
                      <button onClick={() => setDeleteTarget(d)} className="btn-mini btn-mini-clay">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: 400 }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontWeight: 600, fontSize: 15 }}>{editing ? 'Editar destino' : 'Nuevo destino'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded" style={{ color: 'var(--text-tertiary)' }} aria-label="Cerrar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Personal, Degustación, Elaboración interna" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={submitting || !name.trim()} className="btn-primary flex-1">
                  {submitting ? <span className="spinner" /> : null}
                  {editing ? 'Guardar cambios' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar borrado */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}>
          <div className="card p-6" style={{ width: '100%', maxWidth: 400 }}>
            <h2 style={{ fontWeight: 600, marginBottom: 8 }}>¿Eliminar destino?</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Vas a eliminar <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{deleteTarget.name}</span>. Los consumos ya registrados con este destino no se ven afectados.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleDelete} className="btn-danger flex-1">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
