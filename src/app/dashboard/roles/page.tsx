'use client'
import { useState, useEffect } from 'react'
import { useTable, useCreate, useUpdate, useDelete } from '@refinedev/core'
import { businessPlanLimitsApi, extractErrorMessage, type BusinessPlanLimits } from '@/lib/api'
import { isPlanLimitError, isPermissionGroupNotAvailableInPlan, isPlatformUnavailable, getErrorMessage } from '@/lib/apiErrors'
import { useToast } from '@/context/ToastContext'
import UpgradePrompt, { type PlanLimitPayload } from '@/components/UpgradePrompt'
import type { Role } from '@/lib/types'

// ─── Sistema de diseño "ZULU" ────────────────────────────────────────────────
// Mismo patrón que dashboard/categorias/page.tsx (CRUD + banner 402), no
// Modal/ConfirmDialog compartidos — esta pantalla sigue esa convención, no
// la de clientes/page.tsx.

// L (23/08/2026) — 8 grupos fijos en código (app-main/src/security/roles.ts).
// CUSTOMER_ONLY queda afuera: es exclusivo de clientes del portal, nunca
// aplica a un rol de STAFF armado acá.
const PERMISSION_GROUPS: { value: string; label: string }[] = [
  { value: 'OWNER_ONLY', label: 'Solo propietario' },
  { value: 'MANAGEMENT', label: 'Gestión' },
  { value: 'STAFF', label: 'Personal interno' },
  { value: 'FRONT_DESK', label: 'Mostrador' },
  { value: 'HOUSEKEEPING_AND_MANAGEMENT', label: 'Housekeeping' },
  { value: 'ORDERS', label: 'Órdenes (POS)' },
  { value: 'BOOKING', label: 'Reservas' },
]

export default function RolesPage() {
  const { toast } = useToast()
  // Sin paginación server-side — son pocos roles por negocio (5 de fábrica + los custom).
  const { result, tableQuery } = useTable<Role>({ resource: 'roles', pagination: { mode: 'off' } })
  const roles = result.data
  const loading = tableQuery.isLoading

  const { mutateAsync: createRole } = useCreate<Role>()
  const { mutateAsync: updateRole } = useUpdate<Role>()
  const { mutateAsync: deleteRoleMutation } = useDelete<Role>()

  // L (23/08/2026) — límites del PLAN de este negocio, para el gating
  // visual (botón "Nuevo rol" bloqueado, checkboxes de grupo premium
  // deshabilitados). GET /api/business/plan-limits no requiere MANAGEMENT.
  const [plan, setPlan] = useState<string>('')
  const [limits, setLimits] = useState<BusinessPlanLimits | null>(null)
  useEffect(() => {
    queueMicrotask(() => {
      businessPlanLimitsApi.get()
        .then(res => { setPlan(res.plan); setLimits(res.limits) })
        .catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [form, setForm] = useState({ name: '', permissionGroups: [] as string[] })
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Banner 402 — los datos vienen del backend, nunca hardcodeados
  const [limitErr, setLimitErr] = useState<PlanLimitPayload | null>(null)
  const [lockedGroupsMsg, setLockedGroupsMsg] = useState<string | null>(null)

  const activeCustomRoleCount = roles.filter(r => !r.isSystem && r.active).length
  const atCustomRoleLimit = limits !== null && activeCustomRoleCount >= limits.maxCustomRoles

  function isGroupAllowed(group: string): boolean {
    if (!limits) return true // no bloquear mientras carga
    return limits.allowedPermissionGroups === 'ALL' || limits.allowedPermissionGroups.includes(group)
  }

  function openCreate() {
    if (atCustomRoleLimit) {
      setLimitErr({ plan, limit: limits!.maxCustomRoles, resource: 'roles personalizados' })
      return
    }
    setEditing(null)
    setForm({ name: '', permissionGroups: [] })
    setLockedGroupsMsg(null)
    setModalOpen(true)
  }

  function openEdit(r: Role) {
    setEditing(r)
    setForm({ name: r.name, permissionGroups: [...r.permissionGroups] })
    setLockedGroupsMsg(null)
    setModalOpen(true)
  }

  function toggleGroup(group: string) {
    if (!isGroupAllowed(group) && !form.permissionGroups.includes(group)) return
    setForm(f => ({
      ...f,
      permissionGroups: f.permissionGroups.includes(group)
        ? f.permissionGroups.filter(g => g !== group)
        : [...f.permissionGroups, group],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setLockedGroupsMsg(null)
    try {
      if (editing) {
        await updateRole({ resource: 'roles', id: editing.id, values: { name: form.name, permissionGroups: form.permissionGroups } })
        toast('Rol actualizado', 'success')
      } else {
        await createRole({ resource: 'roles', values: { name: form.name, permissionGroups: form.permissionGroups } })
        toast('Rol creado', 'success')
      }
      setModalOpen(false)
    } catch (err) {
      // Red de seguridad del backend (por si el gating visual se bypasea) —
      // mismo criterio que dashboard/categorias/page.tsx.
      if (isPlanLimitError(err)) {
        setLimitErr({ plan: err.plan, limit: err.limit, resource: 'roles personalizados' })
        setModalOpen(false)
      } else if (isPermissionGroupNotAvailableInPlan(err)) {
        setLockedGroupsMsg(getErrorMessage(err))
      } else if (isPlatformUnavailable(err)) {
        toast(getErrorMessage(err), 'warning')
      } else {
        toast(getErrorMessage(err), 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRoleMutation({ resource: 'roles', id: deleteTarget.id })
      toast('Rol desactivado', 'success')
      setDeleteTarget(null)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Roles</h1>
          <p className="page-subtitle">Quién puede hacer qué — los 5 de fábrica más los que arme tu negocio</p>
        </div>
        <button onClick={openCreate} disabled={atCustomRoleLimit} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo rol
        </button>
      </div>

      {/* Banner 402 / techo alcanzado — plan y limit vienen del backend */}
      {limitErr && (
        <div className="mb-6">
          <UpgradePrompt
            plan={limitErr.plan}
            limit={limitErr.limit}
            resource={limitErr.resource}
            onDismiss={() => setLimitErr(null)}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg skeleton" />)}
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Grupos de permiso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id}>
                  <td className="table-cell-primary">{r.name}</td>
                  <td>
                    <span className={r.isSystem ? 'badge-completed' : 'badge-confirmed'}>
                      {r.isSystem ? 'De fábrica' : 'Personalizado'}
                    </span>
                    {!r.active && <span className="badge-cancelled" style={{ marginLeft: 6 }}>Inactivo</span>}
                  </td>
                  <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {r.permissionGroups.length} grupo{r.permissionGroups.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.isSystem ? (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No editable</span>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(r)} className="btn-mini btn-mini-neutral">Editar</button>
                        <button onClick={() => setDeleteTarget(r)} className="btn-mini btn-mini-danger">Desactivar</button>
                      </div>
                    )}
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
          <div className="card" style={{ width: '100%', maxWidth: 480 }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontWeight: 600, fontSize: 15 }}>{editing ? 'Editar rol' : 'Nuevo rol'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded" style={{ color: 'var(--text-tertiary)' }} aria-label="Cerrar">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Cajero, Supervisor de turno" required />
              </div>

              <div>
                <label className="label">Grupos de permiso</label>
                <div className="space-y-1.5 mt-1">
                  {PERMISSION_GROUPS.map(g => {
                    const allowed = isGroupAllowed(g.value)
                    const checked = form.permissionGroups.includes(g.value)
                    return (
                      <label
                        key={g.value}
                        className="flex items-center gap-2 text-sm"
                        style={{ color: allowed ? 'var(--text-primary)' : 'var(--text-tertiary)', opacity: allowed ? 1 : 0.6 }}
                        title={allowed ? undefined : 'Disponible en planes superiores'}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!allowed && !checked}
                          onChange={() => toggleGroup(g.value)}
                          style={{ accentColor: 'var(--zulu-form-control)', width: 14, height: 14 }}
                        />
                        {g.label}
                        {!allowed && (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>

              {lockedGroupsMsg && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
                  style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-border)', color: 'var(--danger)' }}
                >
                  {lockedGroupsMsg}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? <span className="spinner" /> : null}
                  {editing ? 'Guardar cambios' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar desactivación */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,33,61,0.45)', backdropFilter: 'blur(3px)' }}>
          <div className="card p-6" style={{ width: '100%', maxWidth: 400 }}>
            <h2 style={{ fontWeight: 600, marginBottom: 8 }}>¿Desactivar rol?</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Vas a desactivar <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{deleteTarget.name}</span>.
              Si hay usuarios activos con este rol, el backend va a rechazarlo — reasignalos primero.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
                {deleting ? <span className="spinner" /> : null}
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
