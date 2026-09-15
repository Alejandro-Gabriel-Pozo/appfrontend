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
// ─── Perfil fiscal del negocio EMISOR (19/08/2026) ────────────────────────────
// Facturación Electrónica AFIP, Fase 1 (app-main/docs/pendientes-2026-08-18.md
// punto P) -- sin conexión real a AFIP todavía, solo los datos que hacen falta
// cargar antes de poder emitir. Sin catálogo cerrado para taxCondition (mismo
// criterio que el backend): texto libre por ahora, AFIP expone sus propios
// catálogos de referencia (FEParamGetCondicionIvaReceptor) para validar en
// serio recién cuando se conecte de verdad.
export interface BusinessProfile {
  id: string
  displayName: string | null
  contactEmail: string | null
  currency: string
  timezone: string
  defaultCheckInTime: string
  defaultCheckOutTime: string
  legalName: string | null
  taxId: string | null
  /**
   * D-15 (15/09/2026, app-main/docs/decisiones-auditoria-fase2-2026-09-15.md
   * §9): el emisor es CUIT-only -- deja de ser editable
   * (`dashboard/mi-negocio/page.tsx` lo muestra fijo). Sigue siendo
   * `string | null` (no un literal) porque la respuesta de GET puede traer
   * lo que ya estuviera persistido antes de este cambio.
   */
  taxIdType: string | null
  taxCondition: string | null
  fiscalAddressLine1: string | null
  fiscalAddressCity: string | null
  fiscalAddressState: string | null
  fiscalAddressPostalCode: string | null
  fiscalAddressCountry: string | null
  afipSalesPoint: number | null
  // CUIT de autenticación AFIP (19/08/2026, Fase 2, hallazgo real durante la
  // conexión a homologación) -- distinto de taxId cuando AFIP exige un CUIT
  // de testing ficticio para probar en homologación. null = se autentica
  // con taxId (caso normal). Vive junto al certificado en la UI porque es
  // config de AUTENTICACIÓN, no de identidad fiscal legal (eso sigue siendo
  // taxId, en "Datos fiscales").
  afipCuit: string | null
  // IVA por defecto (19/08/2026, Fase 2 -- "VAMOS POR CONEXIÓN REAL"): tasa
  // general que se aplica a un cobro sin categoría propia, y si el precio
  // cargado ya trae el IVA adentro o hay que sumarlo aparte. Decisión del
  // dueño: 21% general, precios con IVA incluido (más común de cara al
  // cliente) -- ver pendientes-2026-08-18.md.
  defaultIvaRate: number
  pricesIncludeIva: boolean
}
