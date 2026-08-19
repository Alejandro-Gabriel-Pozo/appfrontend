'use client'
import { apiFetch } from '../http'
import type { RecordWasteInput } from '../catalogo/types'
import type { CompanyProduct } from '../empresa/types'
import type {
  Product, ProductVariant, CreateProductInput, UpdateProductInput,
  CreateVariantInput, UpdateVariantInput,
  RecipeItem, CreateRecipeItemInput, RecordProductionInput,
} from './types'

// ─── Products ─────────────────────────────────────────────────────────────────
export const productsApi = {
  list:   ()                          => apiFetch<Product[]>('/api/products'),
  get:    (id: string)                => apiFetch<Product>(`/api/products/${id}`),
  create: (body: CreateProductInput)  => apiFetch<Product>('/api/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateProductInput) =>
    apiFetch<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string)                => apiFetch<void>(`/api/products/${id}`, { method: 'DELETE' }),
  recordWaste: (body: RecordWasteInput) =>
    apiFetch<unknown>('/api/products/stock/waste', { method: 'POST', body: JSON.stringify(body) }),
  recordProduction: (body: RecordProductionInput) =>
    apiFetch<unknown>('/api/products/stock/production', { method: 'POST', body: JSON.stringify(body) }),
  companyCatalog: () => apiFetch<CompanyProduct[]>('/api/products/company-catalog'),
  companyShare:   (id: string) => apiFetch<Product>(`/api/products/${id}/company/share`, { method: 'POST' }),
  companyPublish: (id: string) => apiFetch<void>(`/api/products/${id}/company/publish`, { method: 'POST' }),
  priceOverride: {
    activate:   (id: string) => apiFetch<Product>(`/api/products/${id}/company/price-override/activate`, { method: 'POST' }),
    deactivate: (id: string) => apiFetch<Product>(`/api/products/${id}/company/price-override/deactivate`, { method: 'POST' }),
    accept:     (id: string) => apiFetch<Product>(`/api/products/${id}/company/price-override/accept`, { method: 'POST' }),
    reject:     (id: string) => apiFetch<Product>(`/api/products/${id}/company/price-override/reject`, { method: 'POST' }),
  },
  recipeOverride: {
    activate:   (id: string) => apiFetch<Product>(`/api/products/${id}/company/recipe-override/activate`, { method: 'POST' }),
    deactivate: (id: string) => apiFetch<Product>(`/api/products/${id}/company/recipe-override/deactivate`, { method: 'POST' }),
    accept:     (id: string) => apiFetch<Product>(`/api/products/${id}/company/recipe-override/accept`, { method: 'POST' }),
    reject:     (id: string) => apiFetch<Product>(`/api/products/${id}/company/recipe-override/reject`, { method: 'POST' }),
  },
}

// ─── Recetas (BOM) — Fase 3 carve-out inventario ───────────────────────────────
export const recipeItemsApi = {
  list:   (productId: string)                    => apiFetch<RecipeItem[]>(`/api/products/${productId}/recipe-items`),
  create: (productId: string, body: CreateRecipeItemInput) =>
    apiFetch<RecipeItem>(`/api/products/${productId}/recipe-items`, { method: 'POST', body: JSON.stringify(body) }),
  update: (productId: string, itemId: string, body: Partial<Pick<CreateRecipeItemInput, 'quantityPerUnit' | 'costPerUnit' | 'yieldPercentage'>>) =>
    apiFetch<RecipeItem>(`/api/products/${productId}/recipe-items/${itemId}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (productId: string, itemId: string) =>
    apiFetch<void>(`/api/products/${productId}/recipe-items/${itemId}`, { method: 'DELETE' }),
}

// ─── Product Variants ─────────────────────────────────────────────────────────
export const variantsApi = {
  list: (productId: string) =>
    apiFetch<ProductVariant[]>(`/api/products/${productId}/variants`),
  create: (productId: string, body: CreateVariantInput) =>
    apiFetch<ProductVariant>(`/api/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(body) }),
  update: (productId: string, variantId: string, body: UpdateVariantInput) =>
    apiFetch<ProductVariant>(`/api/products/${productId}/variants/${variantId}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (productId: string, variantId: string) =>
    apiFetch<void>(`/api/products/${productId}/variants/${variantId}`, { method: 'DELETE' }),
}
