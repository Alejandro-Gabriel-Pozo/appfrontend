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
  /**
   * Identidad operativa (D6, 01/09/2026): `number | null`, a propósito
   * ASIMÉTRICO con `Reservation.reservationNumber` (que es obligatorio).
   * `customer_number` se excluye deliberadamente del `ON CONFLICT DO
   * UPDATE` en `app-main/src/clientes-finanzas/sql.customer.repository.ts`
   * para que un PATCH no lo pise con `NULL`, y hay clientes anteriores a la
   * columna. No "uniformar" este campo con el de `Reservation` — la
   * asimetría es intencional, no un descuido. Se presenta vía
   * `useNumeroOperativo()` en `@/lib/business-context/numero-operativo`,
   * que ya maneja `null` como ausencia legítima (nunca revienta).
   */
  customerNumber: number | null
  fullName: string
  email: string
  kind?: 'INDIVIDUAL' | 'COMPANY'
  active?: boolean
  /** F1-Pieza 1 (23/08/2026) — tipificación para Cuentas Corrientes. */
  enableCurrentAccount?: boolean
  tags?: CustomerTag[]
  createdAt: string
  updatedAt: string
}

export interface CustomerStatement {
  customerId: string
  balance: number
  transactions: FinancialTransaction[]
  /**
   * INVOICE-CHARGES-GUARD-FRONTEND-02 (11/09/2026) — ids de `FinancialTransaction`
   * (siempre `type: 'CHARGE'`) cubiertos por una factura CONSOLIDADA viva
   * (`ISSUED`/`PENDING`/`FAILED_UNCERTAIN`, nunca `REJECTED` — una
   * consolidada rechazada libera el cargo). Ausente por completo (no `[]`)
   * cuando el negocio no tiene el módulo FACTURACION habilitado — el
   * backend no calcula el dato en ese caso (ver `customers.routes.ts`,
   * `app-main`). Consumido por `FacturarButton` para ocultar el botón
   * SOLO en este caso puntual — no toca el resto de los estados (factura
   * individual propia `ISSUED`/`PENDING`/`FAILED_UNCERTAIN` siguen
   * mostrando CAE+PDF o "Reintentar factura", sin cambios).
   */
  coveredByConsolidatedTransactionIds?: string[]
}

export interface CustomerListFilters {
  page?:   number
  limit?:  number
  email?:  string
  search?: string
  /** F1-Pieza 1 (23/08/2026) — filtro RÍGIDO de base para el panel de Cuentas Corrientes. */
  currentAccountEnabled?: boolean
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
