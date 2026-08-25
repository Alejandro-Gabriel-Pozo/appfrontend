'use client'
import { useState, useEffect, useCallback } from 'react'
import { useTable, useCreate } from '@refinedev/core'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { rolesApi, invitationsApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { TeamMember, Role, UserInvitation } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
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
  fullName: string
  dni: string
  phone: string
  employeeNumber: string
  hiredAt: string
}

const EMPTY: FormState = { email: '', password: '', roleId: '', fullName: '', dni: '', phone: '', employeeNumber: '', hiredAt: '' }

export default function UsuariosPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { result, tableQuery } = useTable<TeamMember>({ resource: 'usuarios', pagination: { mode: 'off' } })
  const members = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createMember } = useCreate<TeamMember>()

  const [roles, setRoles] = useState<Role[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // ── Invitaciones (D2, pendientes-2026-08-19.md) ──────────────────────────
  // No migrado a Refine -- mismo criterio que "roles" arriba: es una lista
  // secundaria con acciones con nombre (reenviar/revocar), no CRUD genérico.
  const [invitations, setInvitations] = useState<UserInvitation[]>([])
  const [invitationsLoading, setInvitationsLoading] = useState(true)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState<{ email: string; roleId: string }>({ email: '', roleId: '' })
  const [inviteFieldErrors, setInviteFieldErrors] = useState<Record<string, string>>({})
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<UserInvitation | null>(null)
  const [revoking, setRevoking] = useState(false)

  const reloadInvitations = useCallback(() => {
    setInvitationsLoading(true)
    invitationsApi.list()
      .then(setInvitations)
      .catch(err => toast(extractErrorMessage(err), 'error'))
      .finally(() => setInvitationsLoading(false))
  }, [toast])

  useEffect(() => { queueMicrotask(() => { reloadInvitations() }) }, [reloadInvitations])

  function openInvite() {
    setInviteForm({ email: '', roleId: defaultAssignableRoleId() })
    setInviteFieldErrors({})
    setInviteModalOpen(true)
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault()
    setInviteSubmitting(true)
    setInviteFieldErrors({})
    try {
      await invitationsApi.create({ email: inviteForm.email, roleId: inviteForm.roleId })
      toast('Invitación enviada', 'success')
      setInviteModalOpen(false)
      reloadInvitations()
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setInviteFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setInviteSubmitting(false)
    }
  }

  async function handleResend(invitation: UserInvitation) {
    setResendingId(invitation.id)
    try {
      await invitationsApi.resend(invitation.id)
      toast('Invitación reenviada', 'success')
      reloadInvitations()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setResendingId(null)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await invitationsApi.revoke(revokeTarget.id)
      toast('Invitación cancelada', 'success')
      setRevokeTarget(null)
      reloadInvitations()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setRevoking(false)
    }
  }

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
    setForm({ ...EMPTY, roleId: defaultAssignableRoleId() })
    setFieldErrors({})
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    try {
      await createMember({
        resource: 'usuarios',
        values: {
          email: form.email,
          password: form.password,
          roleId: form.roleId,
          fullName: form.fullName || undefined,
          dni: form.dni || undefined,
          phone: form.phone || undefined,
          employeeNumber: form.employeeNumber || undefined,
          hiredAt: form.hiredAt || undefined,
        },
      })
      toast('Usuario creado', 'success')
      setModalOpen(false)
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Usuarios</h1>
          <p className="page-subtitle">Empleados con acceso al panel</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openInvite} className="btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Invitar por mail
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo usuario
          </button>
        </div>
      </div>

      {!invitationsLoading && invitations.length > 0 && (
        <div className="card table-wrapper mb-4" style={{ overflow: 'hidden' }}>
          <div className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-md)' }}>
            Invitaciones pendientes
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Rol</th>
                <th>Vence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invitations.map(inv => (
                <tr key={inv.id}>
                  <td className="table-cell-primary">{inv.email}</td>
                  <td><span className="badge-completed">{ROLE_LABEL[inv.roleName] ?? inv.roleName}</span></td>
                  <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(inv.expiresAt).toLocaleDateString('es-AR')}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleResend(inv)}
                        disabled={resendingId === inv.id}
                        className="btn-mini btn-mini-neutral"
                      >
                        {resendingId === inv.id ? <span className="spinner" /> : 'Reenviar'}
                      </button>
                      <button onClick={() => setRevokeTarget(inv)} className="btn-mini btn-mini-clay">Cancelar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <th>Nombre</th>
                <th>Email</th>
                <th>Legajo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/dashboard/usuarios/${m.id}`)}>
                  <td className="table-cell-primary">{m.fullName ?? '—'}</td>
                  <td>{m.email}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{m.employeeNumber ?? '—'}</td>
                  <td><span className="badge-completed">{ROLE_LABEL[m.roleName] ?? m.roleName}</span></td>
                  <td><span className={m.active ? 'badge-confirmed' : 'badge-completed'}>{m.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <Link href={`/dashboard/usuarios/${m.id}`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>Ver detalle</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nuevo usuario — edición completa (perfil, rol, contraseña,
          desactivar) vive en /dashboard/usuarios/[id] desde la migración
          de la auditoría de modales (25/08/2026). */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo usuario">
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
              required
            />
            {fieldErrors['email'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['email']}</p>}
          </div>

          <div>
            <label className="label">Nombre completo</label>
            <input
              className="input"
              value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              placeholder="Juan Pérez"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">DNI</label>
              <input
                className="input"
                value={form.dni}
                onChange={e => setForm(f => ({ ...f, dni: e.target.value }))}
                placeholder="30111222"
              />
            </div>
            <div className="flex-1">
              <label className="label">Teléfono</label>
              <input
                className="input"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+54 9 11 5555-5555"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Legajo</label>
              <input
                className="input"
                value={form.employeeNumber}
                onChange={e => setForm(f => ({ ...f, employeeNumber: e.target.value }))}
                placeholder="LEG-001"
              />
            </div>
            <div className="flex-1">
              <label className="label">Fecha de ingreso</label>
              <input
                type="date"
                className="input"
                value={form.hiredAt}
                onChange={e => setForm(f => ({ ...f, hiredAt: e.target.value }))}
              />
            </div>
          </div>

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

          <div>
            <label className="label">Contraseña</label>
            <input
              type="password"
              className="input"
              style={fieldErrors['password'] ? { borderColor: 'var(--danger)' } : undefined}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              minLength={8}
              required
            />
            {fieldErrors['password'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['password']}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? <span className="spinner" /> : null}
              Crear usuario
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal invitar */}
      <Modal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} title="Invitar por mail">
        <form onSubmit={handleInviteSubmit} className="space-y-4">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Le mandamos un mail con un link para que elija su propia contraseña.
            Si ya tiene cuenta en otro negocio, solo confirma con la que ya tiene.
          </p>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              style={inviteFieldErrors['email'] ? { borderColor: 'var(--danger)' } : undefined}
              value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              placeholder="empleado@negocio.com"
              required
            />
            {inviteFieldErrors['email'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{inviteFieldErrors['email']}</p>}
          </div>

          <div>
            <label className="label">Rol</label>
            <select
              className="input"
              value={inviteForm.roleId}
              onChange={e => setInviteForm(f => ({ ...f, roleId: e.target.value }))}
            >
              {assignableRoles.map(r => (
                <option key={r.id} value={r.id}>{ROLE_LABEL[r.name] ?? r.name}</option>
              ))}
            </select>
            {inviteFieldErrors['roleId'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{inviteFieldErrors['roleId']}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setInviteModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={inviteSubmitting} className="btn-primary flex-1">
              {inviteSubmitting ? <span className="spinner" /> : null}
              Enviar invitación
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="¿Cancelar invitación?"
        description={`El link que le mandamos a "${revokeTarget?.email}" deja de funcionar.`}
        confirmLabel="Cancelar invitación"
        variant="danger"
        loading={revoking}
      />
    </div>
  )
}
