'use client'
import { useState, useEffect } from 'react'
import { useTable, useCreate, useUpdate, useDelete } from '@refinedev/core'
import { rolesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useIsOwner } from '@/hooks/useAuthRole'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { TeamMember, Role } from '@/lib/types'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Sin módulo propio — acento brass por defecto (sección 6 del doc).

/**
 * Labels de los 5 roles "sistema" (seedeados al crear el negocio, ver
 * app-main platform.schema.sql BLOQUE ROLES). Un rol custom que el negocio
 * cree no tiene entrada acá — se muestra con su propio `name` tal cual
 * (ver uso de `ROLE_LABEL[role.name] ?? role.name` más abajo).
 */
const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Recepción',
  WAITER: 'Mesero',
  HOUSEKEEPING: 'Limpieza',
}

type FormState = {
  email: string
  password: string
  roleId: string
}

const EMPTY: FormState = { email: '', password: '', roleId: '' }

export default function UsuariosPage() {
  const { toast } = useToast()
  const isOwner = useIsOwner()
  const { result, tableQuery } = useTable<TeamMember>({ resource: 'usuarios', pagination: { mode: 'off' } })
  const members = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createMember } = useCreate<TeamMember>()
  const { mutateAsync: updateMember } = useUpdate<TeamMember>()
  const { mutateAsync: deleteMemberMutation } = useDelete<TeamMember>()

  const [roles, setRoles] = useState<Role[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null)
  const [deleting, setDeleting] = useState(false)

  // OWNER nunca se asigna desde acá (se asigna solo al registrar el
  // negocio) — mismo guard que ya aplica el backend en POST/PUT /api/users.
  // Incluye roles custom que el negocio haya creado, no solo los 4 fijos
  // de antes (14/08/2026).
  const assignableRoles = roles.filter(r => r.name !== 'OWNER' && r.active)

  // Roles no está migrado a esta pantalla — se sigue trayendo directo.
  useEffect(() => {
    queueMicrotask(() => {
      rolesApi.list().then(setRoles).catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

  function defaultAssignableRoleId(): string {
    const receptionist = assignableRoles.find(r => r.name === 'RECEPTIONIST')
    return (receptionist ?? assignableRoles[0])?.id ?? ''
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY, roleId: defaultAssignableRoleId() })
    setFieldErrors({})
    setModalOpen(true)
  }

  function openEdit(m: TeamMember) {
    setEditing(m)
    setForm({
      email: m.email,
      password: '',
      roleId: m.roleName === 'OWNER' ? defaultAssignableRoleId() : m.roleId,
    })
    setFieldErrors({})
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      if (editing) {
        // El email no se puede editar acá — es de la identity, no de la
        // membership. roleId solo se manda si esta membership no es OWNER
        // (no tiene sentido pisar el rol de quien registró el negocio).
        await updateMember({
          resource: 'usuarios',
          id: editing.id,
          values: {
            ...(editing.roleName !== 'OWNER' && { roleId: form.roleId }),
            ...(form.password && { password: form.password }),
          },
        })
        toast('Usuario actualizado', 'success')
      } else {
        await createMember({ resource: 'usuarios', values: { email: form.email, password: form.password, roleId: form.roleId } })
        toast('Usuario creado', 'success')
      }
      setModalOpen(false)
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteMemberMutation({ resource: 'usuarios', id: deleteTarget.id })
      toast('Usuario desactivado', 'success')
      setDeleteTarget(null)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={`bastion`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Usuarios</h1>
          <p className="page-subtitle">Empleados con acceso al panel</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      {!isOwner && (
        <div className="mb-4 px-4 py-3 rounded-lg text-xs badge-completed" style={{ display: 'block' }}>
          Solo el propietario del negocio puede desactivar usuarios. Vos podés crear y editar.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg skeleton" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="card empty-state">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p>Sin usuarios todavía</p>
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td className="table-cell-primary">{m.email}</td>
                  <td><span className="badge-completed">{ROLE_LABEL[m.roleName] ?? m.roleName}</span></td>
                  <td><span className={m.active ? 'badge-confirmed' : 'badge-completed'}>{m.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(m)} className="btn-mini btn-mini-neutral">Editar</button>
                      {/* El propietario nunca se borra desde acá, y solo el propietario puede borrar */}
                      {isOwner && m.roleName !== 'OWNER' && (
                        <button onClick={() => setDeleteTarget(m)} className="btn-mini btn-mini-clay">Desactivar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar usuario' : 'Nuevo usuario'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              style={fieldErrors['email'] ? { borderColor: 'var(--danger)' } : undefined}
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="empleado@negocio.com"
              disabled={!!editing}
              required
            />
            {editing && <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>El email no se puede cambiar desde acá.</p>}
            {fieldErrors['email'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['email']}</p>}
          </div>

          {editing?.roleName !== 'OWNER' && (
            <div>
              <label className="label">Rol</label>
              <select
                className="input"
                value={form.roleId}
                onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
              >
                {assignableRoles.map(r => (
                  <option key={r.id} value={r.id}>{ROLE_LABEL[r.name] ?? r.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">{editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
            <input
              type="password"
              className="input"
              style={fieldErrors['password'] ? { borderColor: 'var(--danger)' } : undefined}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={editing ? 'Dejar vacío para no cambiarla' : '••••••••'}
              minLength={8}
              required={!editing}
            />
            {editing && (
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Si esta persona trabaja en más de un negocio, no vas a poder cambiarle la contraseña desde acá.
              </p>
            )}
            {fieldErrors['password'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['password']}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <span className="spinner" /> : null}
              {editing ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="¿Desactivar usuario?"
        description={`"${deleteTarget?.email}" pierde acceso al panel. No se borra su historial.`}
        confirmLabel="Desactivar"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
