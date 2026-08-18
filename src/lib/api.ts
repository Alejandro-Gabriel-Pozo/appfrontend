'use client'

// Vacío a propósito: /api/* se pide same-origin y next.config.js lo
// reenvía server-side a NEXT_PUBLIC_API_URL (ver comentario ahí — B2).
const BASE = ''

// ─── Tipos de error públicos ──────────────────────────────────────────────────
export type ApiError =
  | { code: 'PLAN_LIMIT_REACHED'; message: string; plan: string; limit: number }
  | { code: 'MODULE_NOT_ENABLED'; message: string; module: string }
  | { code: 'VALIDATION_ERROR';   message: string; errors: ZodFlatErrors }
  | { code: 'PLATFORM_UNAVAILABLE'; message: string }
  | { code: 'UNAUTHORIZED' | 'TOKEN_EXPIRED'; message: string }
  | { code: 'FORBIDDEN'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'INTERNAL_ERROR'; message: string }
  | { code: string; message: string }

export type ApiErrorWithStatus = ApiError & { httpStatus: number }

export interface ZodFlatErrors {
  fieldErrors: Record<string, string[]>
  formErrors:  string[]
}

// ─── Retry con backoff exponencial para cold starts de Render (503) ───────────
// Solo reintenta en 503 (Service Unavailable) y errores de red.
// No reintenta en 4xx (errores del cliente) ni en mutaciones peligrosas.
const RETRYABLE_METHODS = new Set(['GET', 'HEAD'])
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1_500  // 1.5s → 3s → 6s

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Función central de llamadas ─────────────────────────────────────────────
export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const method = (options?.method ?? 'GET').toUpperCase()
  const canRetry = RETRYABLE_METHODS.has(method)

  let attempt = 0

  while (true) {
    let res: Response
    try {
      res = await fetch(`${BASE}${path}`, {
        ...options,
        // La cookie httpOnly de sesión (B2) viaja sola en cada fetch
        // same-origin — no hace falta armar un header Authorization a mano.
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      })
    } catch (networkErr) {
      // Error de red (offline, ECONNREFUSED, etc.)
      if (canRetry && attempt < MAX_RETRIES) {
        attempt++
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
        console.warn(`[api] Error de red en ${path} — reintento ${attempt}/${MAX_RETRIES} en ${delay}ms`)
        await sleep(delay)
        continue
      }
      throw networkErr
    }

    // 503 Service Unavailable — Render cold start
    if (res.status === 503 && canRetry && attempt < MAX_RETRIES) {
      attempt++
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
      console.warn(`[api] 503 en ${path} — reintento ${attempt}/${MAX_RETRIES} en ${delay}ms (cold start)`)
      await sleep(delay)
      continue
    }

    // 204 No Content — éxito sin cuerpo
    if (res.status === 204) return undefined as T

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      const err: ApiErrorWithStatus = {
        code:       body?.code    ?? 'INTERNAL_ERROR',
        message:    body?.message ?? 'Error inesperado',
        httpStatus: res.status,
        ...body,
      }

      // Interceptor global: token expirado o sin autenticación
      if (
        (err.code === 'TOKEN_EXPIRED' || err.code === 'UNAUTHORIZED') &&
        typeof window !== 'undefined'
      ) {
        window.location.href = `/login?reason=${err.code.toLowerCase()}`
      }

      throw err
    }

    return body as T
  }
}

// ─── Error helpers ────────────────────────────────────────────────────────────
export function extractErrorMessage(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'Error inesperado'
  const e = err as Record<string, unknown>
  if (e['errors']) {
    const errors     = e['errors'] as Record<string, unknown>
    const fieldErrors = errors['fieldErrors'] as Record<string, string[]> | undefined
    if (fieldErrors) {
      const first = Object.values(fieldErrors).flat()[0]
      if (first) return first
    }
    const formErrors = errors['formErrors'] as string[] | undefined
    if (formErrors?.length) return formErrors[0]
  }
  if (typeof e['message'] === 'string') return e['message']
  return 'Ocurrió un error'
}

export function extractFieldErrors(err: unknown): Record<string, string> {
  if (typeof err !== 'object' || err === null) return {}
  const e          = err as Record<string, unknown>
  const errors     = e['errors'] as Record<string, unknown> | undefined
  const fieldErrors = errors?.['fieldErrors'] as Record<string, string[]> | undefined
  if (!fieldErrors) return {}
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([k, v]) => [k, v[0] ?? ''])
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────
import type {
  Resource, CreateResourceInput, UpdateResourceInput,
  Category,
  Reservation,
  Customer,
  Product, ProductVariant, CreateProductInput, UpdateProductInput,
  CreateVariantInput, UpdateVariantInput,
  Order, OrderItem, CreateOrderInput, ListOrdersFilters,
  BookableService, CreateBookableServiceInput, UpdateBookableServiceInput, ResourceLock,
  RatePlan, CreateRatePlanInput, UpdateRatePlanInput,
  TeamMember, CreateTeamMemberInput, UpdateTeamMemberInput, Role,
  HousekeepingTask, CreateHousekeepingTaskInput,
  Stay, CheckInInput, CheckOutInput, StayFolio,
  CustomerRate,
  CustomerStatement, FinancialTransaction,
  AccountReceivable,
  OperatingWindow,
  WasteReason, RecordWasteInput,
  RecipeItem, CreateRecipeItemInput, RecordProductionInput,
  Company, CompanyLink, CompanyProduct,
} from './types'

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
}

export interface ReservationFilters {
  page?:   number
  limit?:  number
  status?: string
  from?:   string
  to?:     string
}

export interface CustomerListFilters {
  page?:   number
  limit?:  number
  email?:  string
  search?: string
}

// ─── Resources ────────────────────────────────────────────────────────────────
export const resourcesApi = {
  list:   ()                              => apiFetch<Resource[]>('/api/resources'),
  create: (body: CreateResourceInput)     => apiFetch<Resource>('/api/resources', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateResourceInput) =>
    apiFetch<Resource>(`/api/resources/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string)                   => apiFetch<void>(`/api/resources/${id}`, { method: 'DELETE' }),
}

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

// ─── Team members (empleados) ───────────────────────────────────────────────────
export const usersApi = {
  list:   ()                            => apiFetch<TeamMember[]>('/api/users'),
  create: (body: CreateTeamMemberInput) => apiFetch<TeamMember>('/api/users', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: UpdateTeamMemberInput) =>
    apiFetch<TeamMember>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string)                  => apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' }),
}

// ─── Roles (14/08/2026 — reemplaza el enum fijo de rol) ─────────────────────────
export const rolesApi = {
  list:   ()                                          => apiFetch<Role[]>('/api/roles'),
  get:    (id: string)                                => apiFetch<Role>(`/api/roles/${id}`),
  create: (body: { name: string; permissionGroups: string[] }) =>
    apiFetch<Role>('/api/roles', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { name?: string; permissionGroups?: string[] }) =>
    apiFetch<Role>(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string)                                => apiFetch<void>(`/api/roles/${id}`, { method: 'DELETE' }),
}

// ─── Housekeeping ───────────────────────────────────────────────────────────────
export const housekeepingApi = {
  listByDate: (date?: string) =>
    apiFetch<HousekeepingTask[]>(`/api/housekeeping${date ? `?date=${date}` : ''}`),
  create: (body: CreateHousekeepingTaskInput) =>
    apiFetch<HousekeepingTask>('/api/housekeeping', { method: 'POST', body: JSON.stringify(body) }),
  assign: (id: string, userId: string) =>
    apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/assign`, { method: 'POST', body: JSON.stringify({ userId }) }),
  start: (id: string) => apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/start`, { method: 'POST' }),
  complete: (id: string, notes?: string) =>
    apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/complete`, { method: 'POST', body: JSON.stringify({ notes }) }),
  inspect: (id: string) => apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/inspect`, { method: 'POST' }),
  outOfService: (id: string, reason?: string) =>
    apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/out-of-service`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reset: (id: string) => apiFetch<HousekeepingTask>(`/api/housekeeping/${id}/reset`, { method: 'POST' }),
}

// ─── Stays (check-in / check-out) ────────────────────────────────────────────────
export const staysApi = {
  listActive: () => apiFetch<Stay[]>('/api/stays'),
  checkIn: (body: CheckInInput) => apiFetch<Stay>('/api/stays/check-in', { method: 'POST', body: JSON.stringify(body) }),
  checkOut: (id: string, body: CheckOutInput = {}) =>
    apiFetch<Stay>(`/api/stays/${id}/check-out`, { method: 'POST', body: JSON.stringify(body) }),
  noShow: (id: string) => apiFetch<Stay>(`/api/stays/${id}/no-show`, { method: 'POST' }),
  /** Saldo + transacciones de la estadía (A1, paso 6) — se consulta antes de intentar el check-out. */
  getFolio: (id: string) => apiFetch<StayFolio>(`/api/stays/${id}/folio`),
  /** Transfiere el saldo pendiente a cuenta por cobrar de una empresa. Solo MANAGEMENT (backend lo valida igual). */
  transferToReceivable: (id: string, body: { companyCustomerId: string; notes?: string }) =>
    apiFetch<AccountReceivable>(`/api/stays/${id}/transfer-to-receivable`, { method: 'POST', body: JSON.stringify(body) }),
}

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

// ─── Reservations ─────────────────────────────────────────────────────────────
export const reservationsApi = {
  list: (filters: ReservationFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page)   params.set('page',   String(filters.page))
    if (filters.limit)  params.set('limit',  String(filters.limit))
    if (filters.status) params.set('status', filters.status)
    if (filters.from)   params.set('from',   filters.from)
    if (filters.to)     params.set('to',     filters.to)
    const qs = params.toString()
    return apiFetch<PaginatedResponse<Reservation> | Reservation[]>(
      `/api/reservations${qs ? `?${qs}` : ''}`,
    )
  },
  get:      (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}`),
  create: (body: { resourceId: string; customer: { id: string }; startTime: string; endTime: string; serviceId?: string; details?: Record<string, unknown>; adultos?: number; ninos?: number; ratePlanId?: string }) =>
    apiFetch<Reservation>('/api/reservations', { method: 'POST', body: JSON.stringify(body) }),
  // El backend registra PUT /api/reservations/:id (no PATCH) — antes esto
  // mandaba PATCH y el backend nunca tuvo ese handler, así que editar una
  // reserva desde el dashboard devolvía 404 en silencio.
  update: (id: string, body: { startTime?: string; endTime?: string; details?: Record<string, unknown>; resourceId?: string; adultos?: number | null; ninos?: number | null; ratePlanId?: string | null }) =>
    apiFetch<Reservation>(`/api/reservations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  confirm:  (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}/confirm`,  { method: 'POST' }),
  cancel:   (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}/cancel`,   { method: 'POST' }),
  complete: (id: string)  => apiFetch<Reservation>(`/api/reservations/${id}/complete`, { method: 'POST' }),
}

// ─── Customers ────────────────────────────────────────────────────────────────
export const customersApi = {
  list: (filters: CustomerListFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.page)   params.set('page',   String(filters.page))
    if (filters.limit)  params.set('limit',  String(filters.limit))
    if (filters.email)  params.set('email',  filters.email)
    if (filters.search) params.set('search', filters.search)
    const qs = params.toString()
    return apiFetch<PaginatedResponse<Customer> | Customer[]>(
      `/api/customers${qs ? `?${qs}` : ''}`,
    )
  },
  findByEmail: (email: string) =>
    apiFetch<Customer | null>(`/api/customers?email=${encodeURIComponent(email)}`),
  get: (id: string) => apiFetch<Customer>(`/api/customers/${id}`),
  create: (body: { fullName: string; email: string }) =>
    apiFetch<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ displayName: string; kind: 'INDIVIDUAL' | 'COMPANY'; active: boolean }>) =>
    apiFetch<Customer>(`/api/customers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  addTag: (id: string, tagName: string) =>
    apiFetch<Customer>(`/api/customers/${id}/tags`, { method: 'POST', body: JSON.stringify({ tagName }) }),
  removeTag: (id: string, tagId: string) =>
    apiFetch<void>(`/api/customers/${id}/tags/${tagId}`, { method: 'DELETE' }),
}

// ─── Tarifas especiales ──────────────────────────────────────────────────────
export const customerRatesApi = {
  list: (customerId: string) => apiFetch<CustomerRate[]>(`/api/customers/${customerId}/rates`),
  create: (customerId: string, body: { resourceId?: string; serviceId?: string; price: number; notes?: string }) =>
    apiFetch<CustomerRate>(`/api/customers/${customerId}/rates`, { method: 'POST', body: JSON.stringify(body) }),
  remove: (customerId: string, rateId: string) =>
    apiFetch<void>(`/api/customers/${customerId}/rates/${rateId}`, { method: 'DELETE' }),
}

// ─── Cuentas corrientes ──────────────────────────────────────────────────────
export const customerAccountApi = {
  getStatement: (customerId: string) => apiFetch<CustomerStatement>(`/api/customers/${customerId}/account`),
  recordPayment: (customerId: string, body: { amount: number; idempotencyKey?: string; notes?: string }) =>
    apiFetch<FinancialTransaction>(`/api/customers/${customerId}/payments`, { method: 'POST', body: JSON.stringify(body) }),
}

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

// ─── Empresas multipropiedad (17/08/2026) ─────────────────────────────────────
export const companiesApi = {
  me:     () => apiFetch<CompanyLink>('/api/companies/me'),
  create: (name: string) => apiFetch<Company>('/api/companies', { method: 'POST', body: JSON.stringify({ name }) }),
  link:   (companyId: string) => apiFetch<void>('/api/companies/link', { method: 'POST', body: JSON.stringify({ companyId }) }),
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

// ─── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (filters: ListOrdersFilters = {}) => {
    const params = new URLSearchParams()
    if (filters.customerId)     params.set('customerId', filters.customerId)
    if (filters.status)         params.set('status',     filters.status)
    if (filters.from)           params.set('from',       filters.from)
    if (filters.to)             params.set('to',         filters.to)
    if (filters.limit  != null) params.set('limit',      String(filters.limit))
    if (filters.offset != null) params.set('offset',     String(filters.offset))
    const qs = params.toString()
    return apiFetch<Order[]>(`/api/orders${qs ? `?${qs}` : ''}`)
  },
  get:         (id: string)                    => apiFetch<Order>(`/api/orders/${id}`),
  create:      (body: CreateOrderInput)        => apiFetch<Order>('/api/orders', { method: 'POST', body: JSON.stringify(body) }),
  confirm:     (id: string)                    => apiFetch<Order>(`/api/orders/${id}/confirm`,  { method: 'POST' }),
  complete:    (id: string)                    => apiFetch<Order>(`/api/orders/${id}/complete`, { method: 'POST' }),
  cancel:      (id: string)                    => apiFetch<Order>(`/api/orders/${id}/cancel`,   { method: 'POST' }),
  serve:       (id: string)                    => apiFetch<Order>(`/api/orders/${id}/serve`,    { method: 'POST' }),
  updateNotes: (id: string, notes: string | null) =>
    apiFetch<Order>(`/api/orders/${id}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
  addItem: (id: string, body: { itemType: string; productId?: string | null; productVariantId?: string | null; reservationId?: string | null; quantity: number; unitPrice: number }) =>
    apiFetch<OrderItem>(`/api/orders/${id}/items`, { method: 'POST', body: JSON.stringify(body) }),
  removeItem: (id: string, itemId: string) =>
    apiFetch<void>(`/api/orders/${id}/items/${itemId}`, { method: 'DELETE' }),
}

// ─── Salud del outbox (dead-letter, A9.5/A8.7 — 15/08/2026) ──────────────────
export interface DeadLetterEvent {
  id: number
  eventType: string
  aggregateType: string
  aggregateId: string
  occurredAt: string
  failedAt: string
  retryCount: number
  lastError: string | null
}

export const systemApi = {
  getDeadLetter: () => apiFetch<{ count: number; events: DeadLetterEvent[] }>('/api/system/outbox/dead-letter'),
  retry: (id: number) => apiFetch<void>(`/api/system/outbox/${id}/retry`, { method: 'POST' }),
}

// ─── Módulos habilitados (entitlements) ──────────────────────────────────────
// Record dinámico a propósito, en vez de un enum duplicado del backend:
// la fuente de verdad de qué module_key existen es la tabla `modules` en
// app-main — acá solo se consume lo que venga.
export const businessModulesApi = {
  get: () => apiFetch<{ modules: Record<string, boolean> }>('/api/business/modules'),
}

// ─── Identidad del negocio (punto 5/E5, 15/08/2026) ──────────────────────────
// Hoy solo nombre + contacto -- lo que necesita el remitente del mail de
// reserva confirmada (A2.9: config por tenant, no una constante del sistema).
export interface BusinessProfile {
  id: string
  displayName: string | null
  contactEmail: string | null
}

export const businessProfileApi = {
  get: () => apiFetch<BusinessProfile>('/api/business-profile'),
  update: (body: { displayName?: string | null; contactEmail?: string | null }) =>
    apiFetch<BusinessProfile>('/api/business-profile', { method: 'PUT', body: JSON.stringify(body) }),
}

// ─── Horario de atención ────────────────────────────────────────────────────
export const businessHoursApi = {
  list: () => apiFetch<OperatingWindow[]>('/api/business-hours'),
  create: (body: { dayOfWeek: number; startTime: string; endTime: string }) =>
    apiFetch<OperatingWindow>('/api/business-hours', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/api/business-hours/${id}`, { method: 'DELETE' }),
}

export const resourceHoursApi = {
  list: (resourceId: string) => apiFetch<OperatingWindow[]>(`/api/resources/${resourceId}/hours`),
  create: (resourceId: string, body: { dayOfWeek: number; startTime: string; endTime: string }) =>
    apiFetch<OperatingWindow>(`/api/resources/${resourceId}/hours`, { method: 'POST', body: JSON.stringify(body) }),
  remove: (resourceId: string, hourId: string) =>
    apiFetch<void>(`/api/resources/${resourceId}/hours/${hourId}`, { method: 'DELETE' }),
}
