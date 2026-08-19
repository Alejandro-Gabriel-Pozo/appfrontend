'use client'
import { apiFetch } from '../http'
import type { Category, WasteReason } from './types'

// ─── Categories ───────────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => apiFetch<Category[]>('/api/categories'),
  create: (body: { name: string; description?: string; fields: Category['fields'] }) =>
    apiFetch<Category>('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ name: string; description: string; fields: Category['fields']; active: boolean }>) =>
    apiFetch<Category>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) =>
    apiFetch<void>(`/api/categories/${id}`, { method: 'DELETE' }),
}

// ─── Waste reasons (catálogo de motivos de merma, Fase 2 carve-out inventario) ─
export const wasteReasonsApi = {
  list:   ()                      => apiFetch<WasteReason[]>('/api/waste-reasons'),
  create: (name: string)          => apiFetch<WasteReason>('/api/waste-reasons', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id: string, body: Partial<{ name: string; active: boolean }>) =>
    apiFetch<WasteReason>(`/api/waste-reasons/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) =>
    apiFetch<void>(`/api/waste-reasons/${id}`, { method: 'DELETE' }),
}
