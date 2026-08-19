import type { FinancialTransaction } from '../finanzas/types'

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface CustomerTag {
  id: string
  name: string
}

export interface CustomerRate {
  id: string
  businessId: string
  customerId: string
  resourceId: string | null
  serviceId: string | null
  price: number
  active: boolean
  notes?: string | null
}

export interface Customer {
  id: string
  businessId: string
  fullName: string
  email: string
  kind?: 'INDIVIDUAL' | 'COMPANY'
  active?: boolean
  tags?: CustomerTag[]
  createdAt: string
  updatedAt: string
}

export interface CustomerStatement {
  customerId: string
  balance: number
  transactions: FinancialTransaction[]
}

export interface CustomerListFilters {
  page?:   number
  limit?:  number
  email?:  string
  search?: string
}
