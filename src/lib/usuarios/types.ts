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
}

export interface CreateTeamMemberInput {
  email: string
  password: string
  roleId: string
}

export interface UpdateTeamMemberInput {
  roleId?: string
  password?: string
}
