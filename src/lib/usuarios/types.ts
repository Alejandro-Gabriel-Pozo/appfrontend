// ─── Team members (empleados) ───────────────────────────────────────────────────
// `id` acá es el id de la MEMBERSHIP (persona + este negocio + rol), no de la
// identity — una misma persona puede tener membership en más de un negocio,
// cada una con su propio id. Ver backend: src/api/routes/users.routes.ts.

/**
 * 14/08/2026 — el backend reemplazó el rol fijo por una entidad
 * configurable (ver app-main docs/pendientes-2026-08-14.md sección H).
 * `role`/`EmployeeRole`/`AssignableEmployeeRole` (un enum de 5 valores
 * fijos) ya no existen del lado del backend — `TeamMember` ahora expone
 * `roleId` (FK real) + `roleName` (para mostrar, puede ser cualquier
 * string: un rol custom que el negocio haya creado, no solo los 5
 * originales).
 */
export interface Role {
  id: string
  businessId: string
  name: string
  /** Uno de los 5 roles seedeados al crear el negocio — no se puede desactivar */
  isSystem: boolean
  active: boolean
  permissionGroups: string[]
  createdAt: string
  updatedAt: string
}

export interface TeamMember {
  id: string
  identityId: string
  businessId: string
  businessName: string
  roleId: string
  roleName: string
  active: boolean
  createdAt: string
  email: string
  /** F2 (23/08/2026) — de la PERSONA (identity), compartido si trabaja en más de un negocio. */
  fullName: string | null
  dni: string | null
  phone: string | null
  /** F2 (23/08/2026) — del EMPLEO en ESTE negocio (membership), no de la persona. */
  employeeNumber: string | null
  hiredAt: string | null
}

export interface CreateTeamMemberInput {
  email: string
  password: string
  roleId: string
  fullName?: string
  dni?: string
  phone?: string
  employeeNumber?: string
  hiredAt?: string
}

export interface UpdateTeamMemberInput {
  roleId?: string
  password?: string
  fullName?: string
  dni?: string
  phone?: string
  employeeNumber?: string
  hiredAt?: string
}

// ─── Invitaciones (D2, pendientes-2026-08-19.md) ────────────────────────────
// Vía alternativa a la alta directa de arriba: el ADMIN solo carga
// email + rol, la persona invitada define su propia contraseña (o, si ya
// tiene cuenta en otro negocio, solo confirma la invitación con la que ya
// tiene). Ver backend: app-main src/usuarios-roles/user-invitation.routes.ts.

export type UserInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED'

export interface UserInvitation {
  id: string
  businessId: string
  businessName: string
  email: string
  roleId: string
  roleName: string
  status: UserInvitationStatus
  invitedByIdentityId: string
  acceptedIdentityId: string | null
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface CreateInvitationInput {
  email: string
  roleId: string
}

/** Respuesta de POST /api/invitations/lookup — antes de pedir password. */
export interface InvitationPreview {
  email: string
  businessName: string
  roleName: string
  /** false si el email ya tiene una identity (de este u otro negocio) -- no hace falta password. */
  requiresPassword: boolean
}

export interface AcceptInvitationInput {
  token: string
  /** Solo si `InvitationPreview.requiresPassword` es true. */
  password?: string
}
