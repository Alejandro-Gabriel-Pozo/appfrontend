// ─── Portal de clientes ─────────────────────────────────────────────────────
// Sesión de un cliente final autenticado en /portal/[businessSlug]. A
// diferencia del JWT de staff, la respuesta de register/login del backend
// (app-main/src/api/routes/customer.routes.ts) ya trae el objeto `customer`
// completo — no hace falta decodificar el JWT en el front. `businessSlug` se
// guarda junto al token porque customerApiFetch es una función fuera de
// React (no hook) y necesita saber a qué /portal/{slug}/login redirigir en
// un 401, sin depender de useParams().

export interface CustomerSession {
  token: string
  customer: { id: string; fullName: string; email: string }
  businessSlug: string
}

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
