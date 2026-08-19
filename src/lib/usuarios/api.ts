'use client'
import { apiFetch } from '../http'
import type { TeamMember, CreateTeamMemberInput, UpdateTeamMemberInput, Role } from './types'

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
