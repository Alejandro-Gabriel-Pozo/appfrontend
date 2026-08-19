// ─── Empresas multipropiedad (17/08/2026) ─────────────────────────────────────

export interface Company {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface CompanyLink {
  companyId: string | null
  companyName: string | null
}

export interface CompanyProduct {
  id: string
  companyId: string
  name: string
  basePrice: number
  sku: string | null
  updatedAt: string
}
