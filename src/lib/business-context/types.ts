/**
 * Contrato de `BusinessContext` — V3.
 *
 * Espejo del contrato definido en el backend:
 * `app-main/docs/plan-separacion-dominios-multirubro-2026-08-28.md` §5.4
 * (payload) y §5.5 (consumo, que es la precondición de esta fase).
 *
 * Estos tipos existen ANTES que el endpoint a propósito. La capa visual del
 * shell se construye contra esta forma, no contra una versión simplificada
 * que después obligue a rehacerla. Cuando la Fase 4 exponga
 * `GET /api/business/context`, lo único que cambia es la FUENTE — ver
 * `provider.tsx`.
 */

/** Los 6 de `ModuleKey` en `app-main/src/types/enums.ts`. */
export type ModuleKey =
  | 'REPORTES'
  | 'HOUSEKEEPING'
  | 'CUENTAS_CORRIENTES'
  | 'POS_RESTAURANTE'
  | 'FACTURACION'
  | 'ALOJAMIENTO'

/**
 * Enum CERRADO. Superadmin elige de acá, nunca un color libre.
 * El cian NO es asignable: queda reservado al plano técnico (criterio 12).
 */
export type ContextColor = 'BRASS' | 'CLAY' | 'SAGE' | 'NEUTRAL'

/** De dónde salió que el módulo esté prendido — la cascada de §5.4. */
export type ModuleSource = 'PRESET' | 'SUPERADMIN' | 'TENANT'

export interface NavigationItem {
  moduleKey: ModuleKey | null   // null = ítem transversal, sin módulo que lo gatee
  label: string
  href: string
  contextColor: ContextColor
}

export interface BusinessContext {
  businessId: string

  /**
   * `null` NO es lo mismo que `'GENERIC'`.
   *   'GENERIC'  -> negocio clasificado, con preset propio.
   *   null       -> negocio SIN clasificar (los que existen desde antes de
   *                 que el rubro existiera).
   * Con `null` no se infiere el rubro ni se cae a ALOJAMIENTO — decisión 1
   * del dueño, §5.5.3.
   */
  industryKey: string | null
  industryName: string | null

  enabledModules: ModuleKey[]
  moduleSources: Partial<Record<ModuleKey, ModuleSource>>

  /** Ya resuelta por la cascada tenant -> industry -> system. */
  terminology: Record<string, string>

  /**
   * Grupos de `security/roles.ts`, NO una lista de permisos.
   * El frontend los usa para navegación y presentación; quien autoriza de
   * verdad sigue siendo el backend. Un segundo catálogo de permisos acá se
   * desincronizaría del que sí manda.
   */
  permissionGroups: string[]

  locale: string
  currency: string
  timezone: string

  navigation: NavigationItem[]
}

/**
 * Tres estados, no dos.
 *
 * Hoy `useBusinessModules()` devuelve `Record | null` y ese `null` significa
 * "cargando" Y "falló" a la vez, así que el shell no puede distinguir entre
 * mostrar un esqueleto y avisar de un problema.
 *
 * `error` sigue siendo FAIL-OPEN en navegación: se muestran todos los ítems.
 * El gate real es el backend (402 `MODULE_NOT_ENABLED`), y ocultar de más
 * deja al usuario sin camino a una función que sí tiene. Pero la navegación
 * en estado `error` no es prueba de que la capacidad esté habilitada.
 */
export type BusinessContextState =
  | { status: 'loading' }
  | { status: 'ready'; context: BusinessContext }
  | { status: 'error'; error: Error }

/** Una fuente de contexto: mock en desarrollo visual, endpoint en integración. */
export type BusinessContextSource = () => Promise<BusinessContext>
