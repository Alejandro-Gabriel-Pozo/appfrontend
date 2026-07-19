// Tipos alineados con los contratos reales de la API (app repo)

export interface Category {
  id: string
  name: string
  description?: string
  fields: CategoryField[]
  active: boolean
}

export interface CategoryField {
  name: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'date'
  required: boolean
  options?: string[]
}

// ─── Products ────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  businessId: string
  categoryId: string | null
  name: string
  description: string | null
  basePrice: number
  sku: string | null
  /**
   * true  → stock y precio se gestionan por variante.
   * false → stock y precio directamente en el producto.
   */
  hasVariants: boolean
  /** Solo relevante cuando hasVariants === false */
  stockQuantity: number
  stockMinAlert: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductVariant {
  id: string
  productId: string
  name: string
  /** Atributos libres: { talle: 'M', color: 'rojo' } */
  attributes: Record<string, string>
  sku: string | null
  /**
   * NULL → hereda basePrice del producto padre.
   * Resuelto siempre en el dominio por ProductService.
   */
  priceOverride: number | null
  stockQuantity: number
  stockMinAlert: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProductInput {
  categoryId?: string | null
  name: string
  description?: string | null
  basePrice: number
  sku?: string | null
  hasVariants?: boolean
  stockQuantity?: number
  stockMinAlert?: number
}

export interface UpdateProductInput {
  categoryId?: string | null
  name?: string
  description?: string | null
  basePrice?: number
  sku?: string | null
  hasVariants?: boolean
  stockQuantity?: number
  stockMinAlert?: number
  active?: boolean
}

export interface CreateVariantInput {
  name: string
  attributes?: Record<string, string>
  sku?: string | null
  priceOverride?: number | null
  stockQuantity?: number
  stockMinAlert?: number
}

export interface UpdateVariantInput {
  name?: string
  attributes?: Record<string, string>
  sku?: string | null
  priceOverride?: number | null
  stockQuantity?: number
  stockMinAlert?: number
  active?: boolean
}
