import { describe, expect, it } from 'vitest'
import {
  getErrorMessage,
  getFieldErrors,
  isApiError,
  isForbidden,
  isNotFound,
  isPermissionGroupNotAvailableInPlan,
  isPlanLimitError,
  isPlatformUnavailable,
  isUnauthorized,
  isValidationError,
} from '@/lib/apiErrors'

describe('isApiError', () => {
  it('reconoce un ApiError con code/message/httpStatus', () => {
    expect(isApiError({ code: 'NOT_FOUND', message: 'x', httpStatus: 404 })).toBe(true)
  })

  it('rechaza valores que no tienen la forma de ApiError', () => {
    expect(isApiError(null)).toBe(false)
    expect(isApiError(undefined)).toBe(false)
    expect(isApiError('error plano')).toBe(false)
    expect(isApiError({ message: 'sin code ni httpStatus' })).toBe(false)
  })
})

describe('type guards por code', () => {
  it('distinguen cada code y no confunden uno con otro', () => {
    const planLimit = { code: 'PLAN_LIMIT_REACHED', message: 'x', httpStatus: 402 }
    const permGroup = { code: 'PERMISSION_GROUP_NOT_AVAILABLE_IN_PLAN', message: 'x', httpStatus: 402 }
    const validation = { code: 'VALIDATION_ERROR', message: 'x', httpStatus: 422 }
    const unauthorized = { code: 'UNAUTHORIZED', message: 'x', httpStatus: 401 }
    const tokenExpired = { code: 'TOKEN_EXPIRED', message: 'x', httpStatus: 401 }
    const forbidden = { code: 'FORBIDDEN', message: 'x', httpStatus: 403 }
    const notFound = { code: 'NOT_FOUND', message: 'x', httpStatus: 404 }
    const platformDown = { code: 'PLATFORM_UNAVAILABLE', message: 'x', httpStatus: 503 }

    expect(isPlanLimitError(planLimit)).toBe(true)
    expect(isPlanLimitError(permGroup)).toBe(false)

    expect(isPermissionGroupNotAvailableInPlan(permGroup)).toBe(true)
    expect(isPermissionGroupNotAvailableInPlan(planLimit)).toBe(false)

    expect(isValidationError(validation)).toBe(true)
    expect(isValidationError(notFound)).toBe(false)

    expect(isUnauthorized(unauthorized)).toBe(true)
    expect(isUnauthorized(tokenExpired)).toBe(true)
    expect(isUnauthorized(forbidden)).toBe(false)

    expect(isForbidden(forbidden)).toBe(true)
    expect(isForbidden(unauthorized)).toBe(false)

    expect(isNotFound(notFound)).toBe(true)
    expect(isNotFound(forbidden)).toBe(false)

    expect(isPlatformUnavailable(platformDown)).toBe(true)
    expect(isPlatformUnavailable(notFound)).toBe(false)
  })
})

describe('getErrorMessage', () => {
  it('usa el message de un ApiError', () => {
    expect(getErrorMessage({ code: 'NOT_FOUND', message: 'no existe', httpStatus: 404 })).toBe('no existe')
  })

  it('cae a un Error genérico con message', () => {
    expect(getErrorMessage({ message: 'boom' })).toBe('boom')
  })

  it('devuelve el mensaje por defecto para valores sin forma reconocible', () => {
    expect(getErrorMessage('string suelto')).toBe('Ocurrió un error inesperado')
    expect(getErrorMessage(null)).toBe('Ocurrió un error inesperado')
  })
})

describe('getFieldErrors', () => {
  it('devuelve vacío si el error no es VALIDATION_ERROR', () => {
    expect(getFieldErrors({ code: 'NOT_FOUND', message: 'x', httpStatus: 404 })).toEqual({})
  })

  it('toma el primer mensaje de cada campo del fieldErrors', () => {
    const err = {
      code: 'VALIDATION_ERROR',
      message: 'x',
      httpStatus: 422,
      errors: { fieldErrors: { email: ['requerido', 'formato inválido'], nombre: ['requerido'] } },
    }
    expect(getFieldErrors(err)).toEqual({ email: 'requerido', nombre: 'requerido' })
  })

  it('no revienta si un campo no tiene mensajes', () => {
    const err = {
      code: 'VALIDATION_ERROR',
      message: 'x',
      httpStatus: 422,
      errors: { fieldErrors: { email: [] } },
    }
    expect(getFieldErrors(err)).toEqual({ email: '' })
  })
})
