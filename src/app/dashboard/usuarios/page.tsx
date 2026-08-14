'use client'
import { useState, useEffect, useCallback } from 'react'
import { usersApi, rolesApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { TeamMember, Role } from '@/lib/types'

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
  const { user: currentUser } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isOwner = currentUser?.role === 'OWNER'

  // OWNER nunca se asigna desde acá (se asigna solo al registrar el
  // negocio) — mismo guard que ya aplica el backend en POST/PUT /api/users.
  // Incluye roles custom que el negocio haya creado, no solo los 4 fijos
  // de antes (14/08/2026).
  const assignableRoles = roles.filter(r => r.name !== 'OWNER' && r.active)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [membersRes, rolesRes] = await Promise.all([usersApi.list(), rolesApi.list()])
      setMembers(membersRes)
      setRoles(rolesRes)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

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
        await usersApi.update(editing.id, {
          ...(editing.roleName !== 'OWNER' && { roleId: form.roleId }),
          ...(form.password && { password: form.password }),
        })
        toast('Usuario actualizado', 'success')
      } else {
        await usersApi.create({ email: form.email, password: form.password, roleId: form.roleId })
        toast('Usuario creado', 'success')
      }
      setModalOpen(false)
      load()
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
      await usersApi.remove(deleteTarget.id)
      toast('Usuario desactivado', 'success')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Usuarios</h1>
          <p className="text-sm text-slate-400 mt-0.5">Empleados con acceso al panel</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      {!isOwner && (
        <div className="mb-4 px-4 py-3 rounded-lg text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20">
          Solo el propietario del negocio puede desactivar usuarios. Vos podés crear y editar.
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-slate-400 font-medium">Sin usuarios todavía</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5 font-medium text-white">{m.email}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                      {ROLE_LABEL[m.roleName] ?? m.roleName}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      m.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {m.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(m)} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors" aria-label="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      {/* El propietario nunca se borra desde acá, y solo el propietario puede borrar */}
                      {isOwner && m.roleName !== 'OWNER' && (
                        <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors" aria-label="Desactivar">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
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
              className={`input ${fieldErrors['email'] ? 'border-red-500/60' : ''}`}
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="empleado@negocio.com"
              disabled={!!editing}
              required
            />
            {editing && <p className="mt-1 text-xs text-slate-500">El email no se puede cambiar desde acá.</p>}
            {fieldErrors['email'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['email']}</p>}
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
              className={`input ${fieldErrors['password'] ? 'border-red-500/60' : ''}`}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={editing ? 'Dejar vacío para no cambiarla' : '••••••••'}
              minLength={8}
              required={!editing}
            />
            {editing && (
              <p className="mt-1 text-xs text-slate-500">
                Si esta persona trabaja en más de un negocio, no vas a poder cambiarle la contraseña desde acá.
              </p>
            )}
            {fieldErrors['password'] && <p className="mt-1 text-xs text-red-400">{fieldErrors['password']}</p>}
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
