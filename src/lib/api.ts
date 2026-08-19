'use client'

// ─── Barrel de compatibilidad (Fase 5, docs/auditoria-modularidad.md) ────────
// lib/api.ts dejó de tener los clientes de API de TODOS los dominios de
// negocio en un solo archivo de 500+ líneas -- cada uno ahora vive en
// lib/<dominio>/api.ts, junto a lib/<dominio>/types.ts (mismo patrón que ya
// usa el backend con sus carpetas). El fetch base + manejo de error +
// interceptor de sesión vencida (antes duplicado con platformApi.ts, Fase 3
// hallazgo F3) vive en lib/http.ts. Este archivo queda como punto de
// entrada único para que las pantallas del dashboard que ya hacían
// `import { x } from '@/lib/api'` no necesiten tocar un solo import — ver
// docs/convenciones-nombres.md para el árbol completo.

export { handleApiResponse, apiFetch, extractErrorMessage, extractFieldErrors } from './http'
export type { ApiError, ApiErrorWithStatus, ZodFlatErrors, PaginatedResponse } from './http'

export { resourcesApi, resourceHoursApi } from './recursos/api'
export { bookableServicesApi, resourceLocksApi, ratePlansApi, serviceSchedulesApi } from './servicios/api'
export { reservationsApi } from './reservas/api'
export type { ReservationFilters } from './reservas/api'
export { usersApi, rolesApi } from './usuarios/api'
export { housekeepingApi } from './housekeeping/api'
export { staysApi } from './estadias/api'
export { categoriesApi, wasteReasonsApi } from './catalogo/api'
export { customersApi, customerRatesApi, customerAccountApi } from './clientes/api'
export type { CustomerListFilters } from './clientes/types'
export { productsApi, recipeItemsApi, variantsApi } from './productos/api'
export { companiesApi } from './empresa/api'
export { ordersApi } from './ordenes/api'
export { systemApi } from './sistema/api'
export type { DeadLetterEvent } from './sistema/types'
export { businessModulesApi, businessProfileApi, businessHoursApi } from './negocio/api'
export type { BusinessProfile } from './negocio/types'
export { afipCredentialsApi, invoicesApi } from './facturacion/api'
export type { AfipCredentialsStatus, Invoice } from './facturacion/types'
