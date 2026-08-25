/**
 * Ventanas de mantenimiento (24/08/2026) — reemplazan al flag OUT_OF_SERVICE
 * de housekeeping como mecanismo de bloqueo de disponibilidad. Ver
 * app-main/docs/diseno-housekeeping-ventana-mantenimiento-2026-08-24.md.
 */
export interface MaintenanceWindow {
  id: string
  businessId: string
  resourceId: string
  /** 'YYYY-MM-DD'. */
  startDate: string
  /** 'YYYY-MM-DD', `null` = ventana abierta ("hasta nuevo aviso"). */
  endDate: string | null
  reason: string | null
  createdBy: string
  closedBy: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  isOpenEnded: boolean
}

export interface CreateMaintenanceWindowInput {
  resourceId: string
  startDate: string
  endDate?: string
  reason?: string
}
