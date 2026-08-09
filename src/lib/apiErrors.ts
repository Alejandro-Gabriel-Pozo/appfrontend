/**
 * apiErrors.ts — Type guards y helpers para manejar ApiError en componentes.
 *
 * Uso:
 *   try { await categoriesApi.create(data) }
 *   catch (err) {
 *     if (isPlanLimitError(err)) showUpgradePrompt(err)
 *     else if (isValidationError(err)) setFieldErrors(err.errors.fieldErrors)
 *     else if (isPlatformUnavailable(err)) showRetryToast(err.message)
 *     else showGenericError(getErrorMessage(err))
 *   }
 *
 * NUNCA hacer: if (err.httpStatus === 403) — usar siempre err.code.
 */
import type { ApiError, ApiErrorWithStatus, ZodFlatErrors } from './api'

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isApiError(err: unknown): err is ApiErrorWithStatus {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'message' in err &&
    'httpStatus' in err
  )
}

export function isPlanLimitError(
  err: unknown,
): err is Extract<ApiError, { code: 'PLAN_LIMIT_REACHED' }> & { httpStatus: number } {
  return isApiError(err) && err.code === 'PLAN_LIMIT_REACHED'
}

export function isValidationError(
  err: unknown,
): err is Extract<ApiError, { code: 'VALIDATION_ERROR' }> & { httpStatus: number } {
  return isApiError(err) && err.code === 'VALIDATION_ERROR'
}

export function isPlatformUnavailable(
  err: unknown,
): err is Extract<ApiError, { code: 'PLATFORM_UNAVAILABLE' }> & { httpStatus: number } {
  return isApiError(err) && err.code === 'PLATFORM_UNAVAILABLE'
}

export function isUnauthorized(err: unknown): boolean {
  return isApiError(err) && (err.code === 'UNAUTHORIZED' || err.code === 'TOKEN_EXPIRED')
}

export function isForbidden(err: unknown): boolean {
  return isApiError(err) && err.code === 'FORBIDDEN'
}

export function isNotFound(err: unknown): boolean {
  return isApiError(err) && err.code === 'NOT_FOUND'
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

/** Devuelve el mensaje de error listo para mostrar al usuario. */
export function getErrorMessage(err: unknown): string {
  if (isApiError(err)) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return 'Ocurrió un error inesperado'
}

/**
 * Extrae los errores de campo de un VALIDATION_ERROR para pasarlos
 * directamente a setFieldErrors / react-hook-form setError.
 */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (!isValidationError(err)) return {}
  const fe = (err as { errors: ZodFlatErrors }).errors?.fieldErrors
  if (!fe) return {}
  return Object.fromEntries(
    Object.entries(fe).map(([k, v]) => [k, v[0] ?? '']),
  )
}
