// ─── Portal de clientes ─────────────────────────────────────────────────────
// La sesión de un cliente final vive en una cookie httpOnly (19/08/2026,
// ver CustomerAuthContext.tsx) — ya no hay un tipo de "sesión" persistible
// del lado del cliente, el estado se resuelve preguntándole al backend.

export interface AvailabilityResource {
  id: string
  name: string
  categoryId: string
  basePrice: number
}

export interface AvailabilitySearchResult {
  categoryId: string | null
  startTime: string
  endTime: string
  available: AvailabilityResource[]
  total: number
}
