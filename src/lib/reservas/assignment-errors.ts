import { isApiError } from '../apiErrors'
import { extractErrorMessage } from '../http'

/**
 * v11/Fase 1 (25/09/2026, Wave 14 item 4.3 en app-main) -- mensajes de error
 * específicos para el PUT que dispara `RoomCalendar` al soltar una reserva
 * sobre otra fila/recurso (`dashboard/reservas/page.tsx::handleCalendarUpdate`).
 * Solo aplica cuando el PUT manda `resourceId` -- el backend
 * (`reservation.service.ts::updateReservation()`/`assignDeferred()`, en
 * app-main) puede rechazar ese cambio por motivos específicos de la
 * asignación diferida, además de los genéricos de disponibilidad que
 * cualquier PUT de reserva ya puede devolver. Sin este mapeo, el toast
 * mostraba el `message` crudo del backend -- que en el caso de
 * disponibilidad trae el UUID del recurso en vez de su nombre
 * (`reservation-availability.service.ts::assertAllResourcesAvailable()`), y
 * para los códigos `ASSIGNMENT_*` no decía nada sobre QUÉ hacer distinto.
 *
 * Cuatro familias reales de error para este PUT (ver `domain/errors.ts` en
 * app-main):
 * 1. Conflicto de categoría/ocupación/disponibilidad -- el recurso destino
 *    no sirve para esta reserva ahora mismo (`ASSIGNMENT_CATEGORY_MISMATCH`,
 *    `RESOURCE_OCCUPIED`, `RESOURCE_NOT_FOUND`, o el `INVALID_RESERVATION`
 *    genérico que devuelve `assertAllResourcesAvailable()` -- recurso
 *    desactivado, fuera de servicio, sin cupo, o ya ocupado en esas fechas).
 *    `INVALID_RESERVATION` también cubre motivos que NO son "otro recurso
 *    ocupado" (estado de la reserva inválido para el cambio -- p. ej. ya
 *    está COMPLETED --, fecha de inicio en el pasado); esos se distinguen
 *    por texto y, si no matchean ningún motivo conocido, se muestran tal
 *    cual en vez de asumir "ya tiene otra reserva".
 * 2. Carrera de confirmación -- otra acción (check-in, completar, otro PUT
 *    concurrente) ya confirmó esta reserva mientras tanto
 *    (`RESERVATION_ALREADY_ASSIGNED`).
 * 3. Carrera de modificación -- `updateReservation()` detecta que la fila
 *    lockeada difiere del pre-check (recurso o servicio cambiaron
 *    mientras tanto, p. ej. un "Auto Assign All" concurrente)
 *    (`RESERVATION_CONCURRENTLY_MODIFIED`).
 * 4. Combo inválido -- el PUT combinó `resourceId` con otro cambio real de
 *    la reserva (`ASSIGNMENT_COMBINED_CHANGE`). `RoomCalendar::handleUp()`
 *    separa a propósito el paso de confirmar del de mover fechas (ver su
 *    docblock de `PendingAssignmentMove`) así que este PUT en particular no
 *    debería producirlo -- se mapea igual por si el error llega por otro
 *    camino (edición manual del detalle, reintento).
 */
export function describeAssignmentMoveError(err: unknown, targetResourceName: string): string {
  if (!isApiError(err)) return extractErrorMessage(err)

  switch (err.code) {
    case 'ASSIGNMENT_CATEGORY_MISMATCH':
      return `"${targetResourceName}" no es del mismo tipo de unidad que esta reserva necesita -- no se puede confirmar la asignación a una categoría distinta.`
    case 'RESOURCE_OCCUPIED':
      return `"${targetResourceName}" ya tiene un huésped con el check-in hecho -- no se puede asignar ahí.`
    case 'RESERVATION_ALREADY_ASSIGNED':
      return 'Esta reserva ya fue confirmada a una habitación definitiva por otra acción mientras tanto -- recargá la página para ver el estado actual.'
    case 'ASSIGNMENT_COMBINED_CHANGE':
      return 'No se puede confirmar la habitación junto con otro cambio en el mismo movimiento -- volvé a intentarlo moviendo solo la habitación.'
    case 'RESOURCE_NOT_FOUND':
      return `"${targetResourceName}" ya no existe -- recargá la página.`
    case 'INVALID_RESERVATION': {
      // Sin código propio -- assertAllResourcesAvailable() y las
      // validaciones de recurso de updateReservation() comparten
      // INVALID_RESERVATION para varios motivos distintos (ver el docblock
      // de arriba). Se distingue por el texto del mensaje del backend
      // (siempre en español, siempre con esas palabras -- ver
      // reservation-availability.service.ts / reservation.service.ts en
      // app-main) en vez de mostrarlo crudo con el UUID del recurso.
      const msg = err.message ?? ''
      if (msg.includes('desactivado')) return `"${targetResourceName}" está desactivado -- no se puede asignar ahí.`
      if (msg.includes('fuera de servicio')) return `"${targetResourceName}" está fuera de servicio en esas fechas -- no se puede asignar ahí.`
      if (msg.includes('no tiene cupo')) return `"${targetResourceName}" no tiene cupo suficiente en esas fechas.`
      // Discriminador estrecho a propósito -- coincide solo con el mensaje
      // real de assertAllResourcesAvailable() ("... no está disponible en
      // el rango solicitado"). INVALID_RESERVATION también cubre otros
      // motivos que no son "otro recurso ocupado" (estado de la reserva no
      // válido para el cambio, fecha de inicio en el pasado) -- para esos,
      // mostrar err.message tal cual es más honesto que inventar un motivo.
      if (msg.includes('no está disponible')) return `"${targetResourceName}" no está disponible en esas fechas -- ya tiene otra reserva en ese rango.`
      return err.message
    }
    case 'RESERVATION_CONCURRENTLY_MODIFIED':
      return 'Otra acción modificó esta reserva mientras tanto -- recargá la página y volvé a intentarlo.'
    default:
      return err.message
  }
}
