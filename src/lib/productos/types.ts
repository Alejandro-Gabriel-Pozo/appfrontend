// ─── Products ────────────────────────────────────────────────────────────────

export type ProductType = 'RAW_MATERIAL' | 'COMPOSITE' | 'RETAIL'

/** Empresas multipropiedad — estado de un override local sobre un campo compartido (precio/receta). */
export type OverrideStatus = 'INACTIVO' | 'ACTIVO' | 'PENDIENTE_DE_REVISION'

export interface Product {
  id: string
  businessId: string
  categoryId: string | null
  name: string
  description: string | null
  basePrice: number
  sku: string | null
  hasVariants: boolean
  stockQuantity: number
  stockMinAlert: number
  active: boolean
  productType: ProductType
  /** Solo aplica si productType === 'COMPOSITE'. true = receta en vivo, false = necesita stock propio vía Producción. */
  assembleOnDemand: boolean
  /** null = producto local, no compartido con otras sucursales de la misma empresa. */
  companyProductId: string | null
  priceOverrideStatus: OverrideStatus
  /** Solo tiene valor mientras priceOverrideStatus === 'PENDIENTE_DE_REVISION'. */
  pricePendingMasterValue: number | null
  recipeOverrideStatus: OverrideStatus
  /** Solo tiene valor mientras recipeOverrideStatus === 'PENDIENTE_DE_REVISION'. */
  recipePendingMasterSnapshot: Array<{ componentProductId: string; quantityPerUnit: number }> | null
  createdAt: string
  updatedAt: string
}

export interface RecipeItem {
  id: string
  parentProductId: string
  componentProductId: string | null
  componentVariantId: string | null
  quantityPerUnit: number
  costPerUnit: number | null
  yieldPercentage: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateRecipeItemInput {
  componentProductId?: string | null
  componentVariantId?: string | null
  quantityPerUnit: number
  costPerUnit?: number | null
  yieldPercentage?: number | null
}

export interface RecordProductionInput {
  productId: string
  quantity: number
  notes?: string
}

export interface ProductVariant {
  id: string
  productId: string
  name: string
  attributes: Record<string, string>
  sku: string | null
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
  productType?: ProductType
  assembleOnDemand?: boolean
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
  productType?: ProductType
  assembleOnDemand?: boolean
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
