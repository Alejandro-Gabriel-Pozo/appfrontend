// ─── Resource ───────────────────────────────────────────────────────────────

export interface Resource {
  id: string
  name: string
  description?: string | null
  categoryId: string
  basePrice: number
  active: boolean
}

export interface CreateResourceInput {
  name: string
  description?: string | null
  categoryId: string
  basePrice: number
}

export interface UpdateResourceInput {
  name?: string
  description?: string | null
  categoryId?: string
  basePrice?: number
  active?: boolean
}
