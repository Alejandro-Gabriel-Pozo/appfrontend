// Guarda la intención de reserva de un visitante anónimo que buscó
// disponibilidad y tocó "Reservar" antes de tener sesión, para retomarla
// justo después de loguearse/registrarse en el portal (ver
// disponibilidad/page.tsx y cuenta/reservas/page.tsx).
const KEY = '_rh_pending_booking'

export interface PendingBooking {
  resourceId: string
  categoryId: string
  startTime: string
  endTime: string
}

export function savePendingBooking(booking: PendingBooking) {
  try { sessionStorage.setItem(KEY, JSON.stringify(booking)) } catch { /* sandboxed */ }
}

export function readPendingBooking(): PendingBooking | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PendingBooking) : null
  } catch {
    return null
  }
}

export function clearPendingBooking() {
  try { sessionStorage.removeItem(KEY) } catch { /* sandboxed */ }
}
