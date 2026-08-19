'use client'
import { apiFetch } from '../http'
import type { Company, CompanyLink } from './types'

// ─── Empresas multipropiedad (17/08/2026) ─────────────────────────────────────
export const companiesApi = {
  me:     () => apiFetch<CompanyLink>('/api/companies/me'),
  create: (name: string) => apiFetch<Company>('/api/companies', { method: 'POST', body: JSON.stringify({ name }) }),
  link:   (companyId: string) => apiFetch<void>('/api/companies/link', { method: 'POST', body: JSON.stringify({ companyId }) }),
}
