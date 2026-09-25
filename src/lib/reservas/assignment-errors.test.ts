import { describe, expect, it } from 'vitest'
import { describeAssignmentMoveError } from './assignment-errors'

const targetName = 'Habitación 12'

describe('describeAssignmentMoveError', () => {
  it('ASSIGNMENT_CATEGORY_MISMATCH -- menciona el recurso y la categoría', () => {
    const err = { code: 'ASSIGNMENT_CATEGORY_MISMATCH', message: 'x', httpStatus: 409 }
    const msg = describeAssignmentMoveError(err, targetName)
    expect(msg).toContain(targetName)
    expect(msg).toContain('categoría')
  })

  it('RESOURCE_OCCUPIED -- menciona el recurso y el check-in activo', () => {
    const err = { code: 'RESOURCE_OCCUPIED', message: 'x', httpStatus: 409 }
    const msg = describeAssignmentMoveError(err, targetName)
    expect(msg).toContain(targetName)
    expect(msg).toContain('check-in')
  })

  it('RESERVATION_ALREADY_ASSIGNED -- pide recargar, sin interpolar el nombre del recurso (ya no es el problema)', () => {
    const err = { code: 'RESERVATION_ALREADY_ASSIGNED', message: 'x', httpStatus: 409 }
    const msg = describeAssignmentMoveError(err, targetName)
    expect(msg).not.toContain(targetName)
    expect(msg).toContain('recargá')
  })

  it('ASSIGNMENT_COMBINED_CHANGE -- pide reintentar moviendo solo la habitación', () => {
    const err = { code: 'ASSIGNMENT_COMBINED_CHANGE', message: 'x', httpStatus: 409 }
    const msg = describeAssignmentMoveError(err, targetName)
    expect(msg).toContain('solo la habitación')
  })

  it('RESOURCE_NOT_FOUND -- avisa que el recurso ya no existe', () => {
    const err = { code: 'RESOURCE_NOT_FOUND', message: 'x', httpStatus: 404 }
    const msg = describeAssignmentMoveError(err, targetName)
    expect(msg).toContain(targetName)
    expect(msg).toContain('ya no existe')
  })

  describe('INVALID_RESERVATION -- distingue el motivo por el texto del mensaje del backend', () => {
    it('recurso desactivado', () => {
      const err = { code: 'INVALID_RESERVATION', message: 'El recurso abc-123 está desactivado.', httpStatus: 400 }
      const msg = describeAssignmentMoveError(err, targetName)
      expect(msg).toContain(targetName)
      expect(msg).toContain('desactivado')
      expect(msg).not.toContain('abc-123')
    })

    it('recurso fuera de servicio', () => {
      const err = { code: 'INVALID_RESERVATION', message: 'El recurso abc-123 está fuera de servicio.', httpStatus: 400 }
      const msg = describeAssignmentMoveError(err, targetName)
      expect(msg).toContain('fuera de servicio')
      expect(msg).not.toContain('abc-123')
    })

    it('sin cupo', () => {
      const err = { code: 'INVALID_RESERVATION', message: 'El recurso abc-123 no tiene cupo suficiente en el rango solicitado (pide 3, quedan 1).', httpStatus: 400 }
      const msg = describeAssignmentMoveError(err, targetName)
      expect(msg).toContain('no tiene cupo suficiente')
      expect(msg).not.toContain('abc-123')
    })

    it('rango no disponible / ya ocupado, sin exponer el UUID del backend', () => {
      const err = { code: 'INVALID_RESERVATION', message: 'El recurso abc-123 no está disponible en el rango solicitado', httpStatus: 400 }
      const msg = describeAssignmentMoveError(err, targetName)
      expect(msg).toContain(targetName)
      expect(msg).not.toContain('abc-123')
    })

    it('estado inválido para el cambio (p. ej. reserva ya COMPLETED) -- NO debe leerse como "ya tiene otra reserva"', () => {
      const err = { code: 'INVALID_RESERVATION', message: 'Solo se pueden modificar reservas en estado PENDING o CONFIRMED. Estado actual: COMPLETED', httpStatus: 400 }
      const msg = describeAssignmentMoveError(err, targetName)
      expect(msg).not.toContain('ya tiene otra reserva')
      expect(msg).toBe(err.message)
    })

    it('fecha de inicio en el pasado -- NO debe leerse como "ya tiene otra reserva"', () => {
      const err = { code: 'INVALID_RESERVATION', message: 'No se puede mover una reserva a una fecha/hora de inicio en el pasado.', httpStatus: 400 }
      const msg = describeAssignmentMoveError(err, targetName)
      expect(msg).not.toContain('ya tiene otra reserva')
      expect(msg).toBe(err.message)
    })
  })

  it('RESERVATION_CONCURRENTLY_MODIFIED -- pide recargar, sin exponer el UUID de la reserva', () => {
    const err = { code: 'RESERVATION_CONCURRENTLY_MODIFIED', message: 'Reservation abc-123 was concurrently modified', httpStatus: 409 }
    const msg = describeAssignmentMoveError(err, targetName)
    expect(msg).not.toContain('abc-123')
    expect(msg).toContain('recargá')
  })

  it('code desconocido -- usa el message tal cual viene (no revienta con un code nuevo sin mapear)', () => {
    const err = { code: 'SOME_FUTURE_CODE', message: 'Mensaje nuevo del backend', httpStatus: 400 }
    expect(describeAssignmentMoveError(err, targetName)).toBe('Mensaje nuevo del backend')
  })

  it('error que no tiene forma de ApiError -- cae al fallback genérico de extractErrorMessage', () => {
    expect(describeAssignmentMoveError({ message: 'boom' }, targetName)).toBe('boom')
    expect(describeAssignmentMoveError(null, targetName)).toBe('Error inesperado')
  })
})
