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

// ─── Perfil fiscal (19/08/2026, auditoría de producto — padrón de ARCA) ────────
// Concepto separado de la identidad básica a propósito (decisión del
// dueño, 18/08/2026) — un cliente puede existir sin datos fiscales.

export interface CustomerTaxProfileAddress {
  line1: string
  line2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  /** ISO 3166-1 alfa-2. El padrón de ARCA solo cubre domicilios argentinos. */
  country: string
}

export interface CustomerTaxProfile {
  id: string
  customerId: string
  legalName: string
  taxId: string
  taxIdType: string
  taxCondition: string | null
  address: CustomerTaxProfileAddress | null
  isDefault: boolean
  createdAt: string
}

export interface UpsertCustomerTaxProfileInput {
  legalName: string
  taxId: string
  taxIdType: string
  taxCondition?: string | null
  address?: CustomerTaxProfileAddress | null
}

/** Resultado de consultar el padrón por CUIT — null si el CUIT no existe ahí. */
export interface TaxpayerLookupResult {
  cuit: string
  legalName: string | null
  taxCondition: 'MONOTRIBUTO' | 'REGIMEN_GENERAL' | null
  address: CustomerTaxProfileAddress | null
}
