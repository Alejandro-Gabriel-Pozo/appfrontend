'use client'
import { apiFetch } from '../http'
import type {
  TeamMember, CreateTeamMemberInput, UpdateTeamMemberInput, Role,
  UserInvitation, CreateInvitationInput, InvitationPreview, AcceptInvitationInput,
  PasswordResetPreview, AcceptPasswordResetInput,
} from './types'

// ─── Team members (empleados) ───────────────────────────────────────────────────
export const usersApi = {
  list:   ()                            => apiFetch<TeamMember[]>('/api/users'),
  create: (body: CreateTeamMemberInput) => apiFetch<TeamMember>('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateTeamMemberInput) =>
    apiFetch<TeamMember>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string)                  => apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' }),
}

// ─── Roles (14/08/2026 — reemplaza el enum fijo de rol) ─────────────────────────
export const rolesApi = {
  list:   ()                                          => apiFetch<Role[]>('/api/roles'),
  get:    (id: string)                                => apiFetch<Role>(`/api/roles/${id}`),
  create: (body: { name: string; permissionGroups: string[] }) =>
    apiFetch<Role>('/api/roles', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; permissionGroups?: string[] }) =>
    apiFetch<Role>(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string)                                => apiFetch<void>(`/api/roles/${id}`, { method: 'DELETE' }),
}

// ─── Invitaciones (D2, pendientes-2026-08-19.md) ────────────────────────────
// Gestión -- requiere sesión de staff (MANAGEMENT), mismo cookie httpOnly
// que el resto de /api/*.
export const invitationsApi = {
  list:   ()                            => apiFetch<UserInvitation[]>('/api/users/invitations'),
  create: (body: CreateInvitationInput) => apiFetch<UserInvitation>('/api/users/invitations', { method: 'POST', body: JSON.stringify(body) }),
  resend: (id: string)                  => apiFetch<void>(`/api/users/invitations/${id}/resend`, { method: 'POST' }),
  revoke: (id: string)                  => apiFetch<void>(`/api/users/invitations/${id}`, { method: 'DELETE' }),
}

// Público -- lo llama alguien SIN sesión todavía (la pantalla de aceptar
// invitación, fuera de /dashboard). `apiFetch` igual sirve: son rutas que
// no chequean cookie del lado del backend, `credentials: 'include'` no
// molesta.
export const invitationAcceptanceApi = {
  lookup: (token: string) =>
    apiFetch<InvitationPreview>('/api/invitations/lookup', { method: 'POST', body: JSON.stringify({ token }) }),
  accept: (body: AcceptInvitationInput) =>
    apiFetch<{ email: string; businessName: string; requiresLogin: boolean }>('/api/invitations/accept', { method: 'POST', body: JSON.stringify(body) }),
}

// ─── Reseteo de contraseña (K1, 23/08/2026, pendientes-2026-08-23.md) ──────
// Gestión -- requiere sesión de staff (MANAGEMENT), dispara el mail con el link.
export const passwordResetApi = {
  requestLink: (membershipId: string) =>
    apiFetch<void>(`/api/users/${membershipId}/password-reset-link`, { method: 'POST' }),
}

// Público -- misma lógica que invitationAcceptanceApi: sin sesión todavía
// (la pantalla de confirmar reseteo, fuera de /dashboard). `request` (L,
// 23/08/2026) es self-service -- el backend responde el mismo mensaje
// genérico exista o no esa cuenta (anti-enumeración, A7.2), la UI no debe
// intentar distinguir los dos casos tampoco.
export const passwordResetAcceptanceApi = {
  request: (email: string) =>
    apiFetch<{ message: string }>('/api/password-resets/request', { method: 'POST', body: JSON.stringify({ email }) }),
  lookup: (token: string) =>
    apiFetch<PasswordResetPreview>('/api/password-resets/lookup', { method: 'POST', body: JSON.stringify({ token }) }),
  accept: (body: AcceptPasswordResetInput) =>
    apiFetch<{ email: string; requiresLogin: boolean }>('/api/password-resets/accept', { method: 'POST', body: JSON.stringify(body) }),
}
