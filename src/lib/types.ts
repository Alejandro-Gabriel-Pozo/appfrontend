// ─── Barrel de compatibilidad (Fase 5, docs/auditoria-modularidad.md) ────────
// lib/types.ts dejó de tener las 63 interfaces de TODOS los dominios de
// negocio en un solo archivo de 650+ líneas -- cada tipo ahora vive en
// lib/<dominio>/types.ts, un archivo por área de negocio (mismo patrón que
// ya usa el backend: reservas/, pms-estadias/, clientes-finanzas/...). Este
// archivo queda como punto de entrada único para que las pantallas del
// dashboard que ya hacían `import type { X } from '@/lib/types'` no
// necesiten tocar un solo import -- ver docs/convenciones-nombres.md para
// el árbol completo de carpetas y qué tipo vive en cada una.

export type { Category, CategoryField, WasteReason, RecordWasteInput } from './catalogo/types'
export type { OperatingWindow, BusinessProfile } from './negocio/types'
export type { CustomerTag, CustomerRate, Customer, CustomerStatement, CustomerListFilters } from './clientes/types'
export type { CustomerTaxProfile, CustomerTaxProfileAddress, UpsertCustomerTaxProfileInput, TaxpayerLookupResult } from './clientes/types'
export type {
  TransactionType, TransactionStatus, FinancialTransaction,
  AccountsReceivableStatus, AccountReceivable, AccountsReceivableReportRow,
  OutstandingInvoice,
} from './finanzas/types'
export type { Resource, CreateResourceInput, UpdateResourceInput } from './recursos/types'
export type { Role, TeamMember, CreateTeamMemberInput, UpdateTeamMemberInput } from './usuarios/types'
export type {
  UserInvitationStatus, UserInvitation, CreateInvitationInput,
  InvitationPreview, AcceptInvitationInput,
} from './usuarios/types'
export type {
  BookingMode, BookableService, CreateBookableServiceInput, UpdateBookableServiceInput,
  ResourceLock, RatePlan, CreateRatePlanInput, UpdateRatePlanInput,
  ServiceSchedule, CreateServiceScheduleInput, UpdateServiceScheduleInput,
} from './servicios/types'
export type { ReservationStatus, Reservation } from './reservas/types'
export type { HousekeepingStatus, Shift, HousekeepingTask, LateCheckout, CreateHousekeepingTaskInput } from './housekeeping/types'
export type { StayStatus, Stay, CheckInInput, CheckOutInput, StayFolio } from './estadias/types'
export type {
  ProductType, OverrideStatus, Product, ProductVariant,
  CreateProductInput, UpdateProductInput, CreateVariantInput, UpdateVariantInput,
  RecipeItem, CreateRecipeItemInput, RecordProductionInput,
} from './productos/types'
export type { Company, CompanyLink, CompanyProduct } from './empresa/types'
export type { OrderStatus, OrderItemType, OrderItem, Order, CreateOrderItemInput, CreateOrderInput, ListOrdersFilters } from './ordenes/types'
export type { AvailabilityResource, AvailabilitySearchResult } from './portal/types'
export type { DeadLetterEvent } from './sistema/types'
export type { AfipCredentialsStatus, InvoiceStatus, Invoice } from './facturacion/types'
