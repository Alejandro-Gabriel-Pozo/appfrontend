'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useUpdate, useDelete } from '@refinedev/core'
import Link from 'next/link'
import { usersApi, rolesApi, passwordResetApi, extractErrorMessage, extractFieldErrors } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { useIsOwner } from '@/hooks/useAuthRole'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { TeamMember, Role } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Sin módulo propio — acento brass por defecto (sección 6 del doc).
// Migrado de modal a ruta dedicada (auditoría UX de modales, 25/08/2026,
// docs/auditoria-modales.md) — el modal "Editar usuario" reunía identidad,
// permisos y seguridad (rol, contraseña/reset link) en un overlay de 480px.

// Mismo criterio que dashboard/usuarios/page.tsx — un solo lugar de verdad
// se volvería un domain helper compartido si un tercer archivo lo necesita;
// por ahora, mismo patrón de duplicación que STATUS_LABEL en ordenes/[id].
const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Recepción',
  WAITER: 'Mesero',
  HOUSEKEEPING: 'Limpieza',
}

type EditFormState = {
  roleId: string
  fullName: string
  dni: string
  phone: string
  employeeNumber: string
  hiredAt: string
  password: string
}

const EMPTY_FORM: EditFormState = { roleId: '', fullName: '', dni: '', phone: '', employeeNumber: '', hiredAt: '', password: '' }

function Skeleton({ h = 20, w = '100%', radius = 8 }: { h?: number; w?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: radius }} />
}

export default function UsuarioDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const { toast } = useToast()
  const isOwner = useIsOwner()
  const { mutateAsync: updateMember } = useUpdate<TeamMember>()
  const { mutateAsync: deleteMemberMutation } = useDelete<TeamMember>()

  const [member, setMember] = useState<TeamMember | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState<EditFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // K1 (23/08/2026, pendientes-2026-08-23.md) — el backend rechaza con 403
  // ROLE_HIERARCHY_PROTECTED si un actor no-OWNER intenta fijar la
  // contraseña de alguien OWNER_ONLY/MANAGEMENT directo por PUT.
  const [sendingResetLink, setSendingResetLink] = useState(false)

  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setNotFound(false)
    try {
      // Sin GET /api/users/:id — mismo criterio que el adapter 'usuarios'
      // de lib/refine/dataProvider.ts (list() + find por id).
      const [all, rolesList] = await Promise.all([usersApi.list(), rolesApi.list()])
      const found = all.find(u => u.id === id)
      if (!found) {
        setNotFound(true)
        return
      }
      setMember(found)
      setRoles(rolesList)
      setForm({
        roleId: found.roleName === 'OWNER' ? '' : found.roleId,
        fullName: found.fullName ?? '',
        dni: found.dni ?? '',
        phone: found.phone ?? '',
        employeeNumber: found.employeeNumber ?? '',
        hiredAt: found.hiredAt ? found.hiredAt.slice(0, 10) : '',
        password: '',
      })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  // OWNER nunca se reasigna desde acá (se asigna solo al registrar el
  // negocio) — mismo guard que ya aplica el backend en PUT /api/users/:id.
  const assignableRoles = roles.filter(r => r.name !== 'OWNER' && r.active)

  // K1 (23/08/2026) — el rol de este usuario, para saber si está protegido
  // por jerarquía (OWNER_ONLY/MANAGEMENT). `member.roleId` es la fuente
  // real (roleName es solo para mostrar, no para autorizar — mismo
  // criterio que el backend, ver platform.repository.ts).
  const memberRole = member ? roles.find(r => r.id === member.roleId) : null
  const isProtected = member?.roleName === 'OWNER'
    || (memberRole?.permissionGroups.some(g => g === 'OWNER_ONLY' || g === 'MANAGEMENT') ?? false)
  const canSetPasswordDirectly = !isProtected || isOwner

  async function handleSendResetLink() {
    if (!member) return
    setSendingResetLink(true)
    try {
      await passwordResetApi.requestLink(member.id)
      toast(`Le mandamos un mail a ${member.email} para restablecer su contraseña`, 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSendingResetLink(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return
    setSaving(true)
    setFieldErrors({})
    try {
      // El email no se puede editar acá — es de la identity, no de la
      // membership. roleId solo se manda si esta membership no es OWNER
      // (no tiene sentido pisar el rol de quien registró el negocio).
      const { data: updated } = await updateMember({
        resource: 'usuarios',
        id: member.id,
        values: {
          ...(member.roleName !== 'OWNER' && { roleId: form.roleId }),
          ...(form.password && { password: form.password }),
          fullName: form.fullName || undefined,
          dni: form.dni || undefined,
          phone: form.phone || undefined,
          employeeNumber: form.employeeNumber || undefined,
          hiredAt: form.hiredAt || undefined,
        },
      })
      toast('Usuario actualizado', 'success')
      setMember(updated)
      setForm(f => ({ ...f, password: '' }))
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast(extractErrorMessage(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!member) return
    setDeactivating(true)
    try {
      await deleteMemberMutation({ resource: 'usuarios', id: member.id })
      toast('Usuario desactivado', 'success')
      setMember(m => m ? { ...m, active: false } : m)
      setConfirmDeactivate(false)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setDeactivating(false)
    }
  }

  // ─── LOADING ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="zulu" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Skeleton h={16} w={80} />
          <Skeleton h={28} w={220} />
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <Skeleton h={260} />
          <Skeleton h={100} />
        </div>
      </div>
    )
  }

  // ─── NOT FOUND ───────────────────────────────────────────────────────────
  if (notFound || !member) {
    return (
      <div className="zulu" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
        <svg style={{ width: 48, height: 48, color: 'var(--text-tertiary)', margin: '0 auto 16px' }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h2 style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Usuario no encontrado</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>El ID ingresado no corresponde a ningún usuario.</p>
        <Link href="/dashboard/usuarios" style={{ color: 'var(--accent)', fontSize: 14 }}>← Volver a Usuarios</Link>
      </div>
    )
  }

  return (
    <div className="zulu" style={{ maxWidth: 640, margin: '0 auto' }}>
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
            href="/dashboard/usuarios"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-tertiary)', textDecoration: 'none' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Usuarios
          </Link>
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{member.fullName ?? member.email}</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{member.email}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge-completed">{ROLE_LABEL[member.roleName] ?? member.roleName}</span>
          <span className={member.active ? 'badge-confirmed' : 'badge-completed'}>{member.active ? 'Activo' : 'Inactivo'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* ── Información ── */}
        <div className="card">
          <div className="detail-card-header">Información</div>
          <div className="detail-card-body">
            <form onSubmit={handleSave} className="space-y-4">
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

              {member.roleName !== 'OWNER' && (
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

              {canSetPasswordDirectly ? (
                <div>
                  <label className="label">Nueva contraseña (opcional)</label>
                  <input
                    type="password"
                    className="input"
                    style={fieldErrors['password'] ? { borderColor: 'var(--danger)' } : undefined}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Dejar vacío para no cambiarla"
                    minLength={8}
                  />
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Si esta persona trabaja en más de un negocio, no vas a poder cambiarle la contraseña desde acá.
                  </p>
                  {fieldErrors['password'] && <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{fieldErrors['password']}</p>}
                </div>
              ) : (
                <div>
                  <label className="label">Contraseña</label>
                  <p className="mt-1 mb-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Por el rol de esta persona, no se puede fijar la contraseña directo desde acá — mandale un link para que la elija ella misma.
                  </p>
                  <button type="button" onClick={handleSendResetLink} disabled={sendingResetLink} className="btn-secondary">
                    {sendingResetLink ? <span className="spinner" /> : null}
                    Enviar link para restablecer contraseña
                  </button>
                </div>
              )}

              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <span className="spinner" /> : null}
                Guardar cambios
              </button>
            </form>
          </div>
        </div>

        {/* ── Zona de riesgo ── */}
        {member.roleName !== 'OWNER' && (
          <div className="card">
            <div className="detail-card-header">Acceso</div>
            <div className="detail-card-body">
              {!member.active ? (
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Este usuario está desactivado — no tiene acceso al panel.</p>
              ) : isOwner ? (
                <>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Desactivar le saca el acceso al panel. No se borra su historial.
                  </p>
                  <button type="button" onClick={() => setConfirmDeactivate(true)} className="btn-mini btn-mini-clay">
                    Desactivar usuario
                  </button>
                </>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Solo el propietario del negocio puede desactivar usuarios.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={handleDeactivate}
        title="¿Desactivar usuario?"
        description={`"${member.email}" pierde acceso al panel. No se borra su historial.`}
        confirmLabel="Desactivar"
        variant="danger"
        loading={deactivating}
      />
    </div>
  )
}
