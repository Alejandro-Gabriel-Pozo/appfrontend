'use client'
import { apiFetch } from '../http'
import type { Category, WasteReason, ConsumptionDestination } from './types'

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

// ─── Consumption destinations (27/08/2026, pendientes-2026-08-27.md — gemelo
// de wasteReasonsApi. Adoptado de `proyecto script`, DESTINOS_CONSUMO) ───────
export const consumptionDestinationsApi = {
  list:   ()                      => apiFetch<ConsumptionDestination[]>('/api/consumption-destinations'),
  create: (name: string)          => apiFetch<ConsumptionDestination>('/api/consumption-destinations', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (id: string, body: Partial<{ name: string; active: boolean }>) =>
    apiFetch<ConsumptionDestination>(`/api/consumption-destinations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) =>
    apiFetch<void>(`/api/consumption-destinations/${id}`, { method: 'DELETE' }),
}
