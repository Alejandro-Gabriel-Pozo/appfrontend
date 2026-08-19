// ─── Horario de atención (negocio + override por recurso) ─────────────────────
// Cascada: si un recurso tiene ventanas propias, reemplazan (no se combinan)
// al horario por defecto del negocio para ese recurso. Ver
// docs/conocimiento-del-negocio.md en app-main.

export interface OperatingWindow {
  id: string
  dayOfWeek: number // 0 = lunes ... 6 = domingo
  startTime: string // HH:MM:SS
  endTime: string
}

// ─── Identidad del negocio (punto 5/E5, 15/08/2026) ──────────────────────────
// Nombre + contacto -- lo que necesita el remitente del mail de reserva
// confirmada (A2.9: config por tenant, no una constante del sistema).
// currency/timezone sumados 17/08/2026 (auditoría de hardcodes) y
// defaultCheckInTime/defaultCheckOutTime el 18/08/2026 (flujo de horario de
// check-in/check-out, pendientes-2026-08-18.md punto N) -- currency/timezone
// siguen sin UI de edición en el dashboard (gap preexistente, no de este
// cambio), se listan acá solo para que el tipo no mienta sobre lo que
// devuelve GET /api/business-profile.
export interface BusinessProfile {
  id: string
  displayName: string | null
  contactEmail: string | null
  currency: string
  timezone: string
  defaultCheckInTime: string
  defaultCheckOutTime: string
}
