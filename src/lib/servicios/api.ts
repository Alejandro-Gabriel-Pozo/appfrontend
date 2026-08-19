'use client'
import { apiFetch } from '../http'
import type {
  BookableService, CreateBookableServiceInput, UpdateBookableServiceInput,
  ResourceLock, RatePlan, CreateRatePlanInput, UpdateRatePlanInput,
} from './types'

// ─── Bookable Services / Resource Locks ────────────────────────────────────────
export const bookableServicesApi = {
  list:   ()                                => apiFetch<BookableService[]>('/api/bookable-services'),
  create: (body: CreateBookableServiceInput) => apiFetch<BookableService>('/api/bookable-services', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateBookableServiceInput) =>
    apiFetch<BookableService>(`/api/bookable-services/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string)                      => apiFetch<void>(`/api/bookable-services/${id}`, { method: 'DELETE' }),
  getAvailableSlots: (serviceId: string, resourceId: string, date: string) =>
    apiFetch<{ slots: string[] }>(`/api/bookable-services/${serviceId}/available-slots?resourceId=${encodeURIComponent(resourceId)}&date=${date}`),
}

export const resourceLocksApi = {
  list:    (serviceId: string)                        => apiFetch<ResourceLock[]>(`/api/bookable-services/${serviceId}/resource-locks`),
  replace: (serviceId: string, resourceIds: string[]) =>
    apiFetch<ResourceLock[]>(`/api/bookable-services/${serviceId}/resource-locks`, { method: 'PUT', body: JSON.stringify({ resourceIds }) }),
}

// ─── Rate Plans (18/08/2026, spec de mejoras PMS) ───────────────────────────────
export const ratePlansApi = {
  list:   (serviceId: string)                    => apiFetch<RatePlan[]>(`/api/bookable-services/${serviceId}/rate-plans`),
  create: (serviceId: string, body: CreateRatePlanInput) =>
    apiFetch<RatePlan>(`/api/bookable-services/${serviceId}/rate-plans`, { method: 'POST', body: JSON.stringify(body) }),
  update: (serviceId: string, ratePlanId: string, body: UpdateRatePlanInput) =>
    apiFetch<RatePlan>(`/api/bookable-services/${serviceId}/rate-plans/${ratePlanId}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (serviceId: string, ratePlanId: string) =>
    apiFetch<void>(`/api/bookable-services/${serviceId}/rate-plans/${ratePlanId}`, { method: 'DELETE' }),
}
