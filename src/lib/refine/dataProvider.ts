import type { DataProvider, BaseRecord, MetaQuery, Pagination, CrudFilters, LogicalFilter } from '@refinedev/core'
import {
  categoriesApi, productsApi, resourcesApi, bookableServicesApi, usersApi,
  customersApi, reservationsApi, staysApi, housekeepingApi, ordersApi,
  wasteReasonsApi, consumptionDestinationsApi, rolesApi,
} from '@/lib/api'
import type { PaginatedResponse } from '@/lib/api'
import type { Category, CreateProductInput, UpdateProductInput } from '@/lib/types'

// ─── Data provider por-recurso (confirmado con el dueño, 18/08/2026) ─────────
// La API real NO es REST uniforme: list() pagina server-side y devuelve
// PaginatedResponse<T> en algunos recursos (reservas, clientes, órdenes...)
// pero no en otros (categorías, productos, que devuelven T[] a secas);
// update() usa PUT en unos recursos y PATCH en otros; varios recursos no
// tienen GET /:id (solo list()); y varios NO tienen un delete real —
// clientes/reservas/estadías/housekeeping/órdenes se "cierran" con acciones
// con nombre (desactivar, cancelar, completar, checkOut...), no con DELETE.
// Por eso este data provider no arma URLs genéricas — delega en las
// funciones ya tipadas de lib/api.ts (única fuente de verdad de cada
// endpoint) y solo adapta la forma de la respuesta al contrato de Refine.
// Sumar un recurso nuevo = agregar una entrada acá, no tocar el resto.
interface ListParams {
  meta?: MetaQuery
  pagination?: Pagination
  filters?: CrudFilters
}

interface ResourceAdapter {
  list: (params: ListParams) => Promise<BaseRecord[] | { data: BaseRecord[]; total: number }>
  getOne: (id: string) => Promise<BaseRecord>
  create: (data: Record<string, unknown>) => Promise<BaseRecord>
  update: (id: string, data: Record<string, unknown>) => Promise<BaseRecord>
  deleteOne: (id: string) => Promise<void>
}

function toArray<T>(res: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(res) ? res : res.data
}

/** A diferencia de toArray(), preserva el total real del servidor cuando
 * la respuesta viene paginada — lo necesitan los recursos migrados a
 * `pagination: { mode: 'server' }` (hoy Clientes y Reservas/Turnos). */
function toPaginated<T>(res: PaginatedResponse<T> | T[]): { data: T[]; total: number } {
  return Array.isArray(res) ? { data: res, total: res.length } : { data: res.data, total: res.total }
}

/** Busca un filtro Refine `{field, operator, value}` por nombre de campo
 * y devuelve su valor como string no vacío, o undefined. */
function getFilterValue(filters: CrudFilters | undefined, field: string): string | undefined {
  const match = filters?.find((f): f is LogicalFilter => 'field' in f && f.field === field)
  return typeof match?.value === 'string' && match.value.trim() ? match.value.trim() : undefined
}

/** Para el puñado de recursos sin un endpoint real de update/delete — las
 * pantallas de esos recursos nunca llaman a esto (usan acciones con nombre,
 * ver comentario de archivo), pero el contrato de ResourceAdapter lo exige. */
function notSupported(action: string, resource: string): never {
  throw new Error(`${resource}: "${action}" no existe como operación genérica — usa una acción con nombre (ver lib/api.ts).`)
}

const resources: Record<string, ResourceAdapter> = {
  categorias: {
    list: () => categoriesApi.list(),
    // Sin GET /api/categories/:id en el backend — se resuelve contra el
    // listado ya traído, mismo criterio que usaba la pantalla antes de Refine.
    getOne: async id => {
      const all = await categoriesApi.list()
      const found = all.find(c => c.id === id)
      if (!found) throw { message: 'Categoría no encontrada', code: 'NOT_FOUND', statusCode: 404, httpStatus: 404 }
      return found
    },
    create: data =>
      categoriesApi.create({
        name: data.name as string,
        description: data.description as string | undefined,
        fields: (data.fields as Category['fields']) ?? [],
      }),
    update: (id, data) => categoriesApi.update(id, data),
    deleteOne: id => categoriesApi.remove(id),
  },
  productos: {
    list: () => productsApi.list(),
    getOne: id => productsApi.get(id),
    create: data => productsApi.create(data as unknown as CreateProductInput),
    update: (id, data) => productsApi.update(id, data as unknown as UpdateProductInput),
    deleteOne: id => productsApi.remove(id),
  },
  recursos: {
    list: () => resourcesApi.list(),
    // Sin GET /api/resources/:id — mismo criterio que categorías.
    getOne: async id => {
      const all = await resourcesApi.list()
      const found = all.find(r => r.id === id)
      if (!found) throw { message: 'Recurso no encontrado', code: 'NOT_FOUND', statusCode: 404, httpStatus: 404 }
      return found
    },
    create: data => resourcesApi.create(data as unknown as Parameters<typeof resourcesApi.create>[0]),
    update: (id, data) => resourcesApi.update(id, data as unknown as Parameters<typeof resourcesApi.update>[1]),
    deleteOne: id => resourcesApi.remove(id),
  },
  servicios: {
    list: () => bookableServicesApi.list(),
    // Sin GET /api/bookable-services/:id.
    getOne: async id => {
      const all = await bookableServicesApi.list()
      const found = all.find(s => s.id === id)
      if (!found) throw { message: 'Servicio no encontrado', code: 'NOT_FOUND', statusCode: 404, httpStatus: 404 }
      return found
    },
    create: data => bookableServicesApi.create(data as unknown as Parameters<typeof bookableServicesApi.create>[0]),
    update: (id, data) => bookableServicesApi.update(id, data as unknown as Parameters<typeof bookableServicesApi.update>[1]),
    deleteOne: id => bookableServicesApi.remove(id),
  },
  usuarios: {
    list: () => usersApi.list(),
    // Sin GET /api/users/:id.
    getOne: async id => {
      const all = await usersApi.list()
      const found = all.find(u => u.id === id)
      if (!found) throw { message: 'Usuario no encontrado', code: 'NOT_FOUND', statusCode: 404, httpStatus: 404 }
      return found
    },
    create: data => usersApi.create(data as unknown as Parameters<typeof usersApi.create>[0]),
    update: (id, data) => usersApi.update(id, data as unknown as Parameters<typeof usersApi.update>[1]),
    // DELETE /api/users/:id en realidad desactiva (mismo patrón que
    // clientes/productos) — igual pasa por deleteOne porque ese es el verbo
    // HTTP real que usa usersApi.remove().
    deleteOne: id => usersApi.remove(id),
  },
  clientes: {
    // K2 (23/08/2026) — único recurso migrado a `pagination: { mode: 'server' }`
    // por ahora (ver dashboard/clientes/page.tsx). El resto sigue en 'off'.
    list: async ({ pagination, filters }) => {
      if (pagination?.mode !== 'server') return toArray(await customersApi.list())
      return toPaginated(await customersApi.list({
        page: pagination.currentPage,
        limit: pagination.pageSize,
        search: getFilterValue(filters, 'search'),
      }))
    },
    getOne: id => customersApi.get(id),
    create: data => customersApi.create(data as unknown as Parameters<typeof customersApi.create>[0]),
    update: (id, data) => customersApi.update(id, data as unknown as Parameters<typeof customersApi.update>[1]),
    // No hay DELETE de clientes — se desactivan editando `active: false`
    // (ClientesPage no ofrece un botón de borrar, no debería llamar a esto).
    deleteOne: id => notSupported('deleteOne', `clientes/${id}`),
  },
  reservas: {
    // K2 (23/08/2026) — segundo recurso migrado a `pagination: { mode: 'server' }`
    // (ver hooks/useReservationsScreen.ts, compartido por Reservas y Turnos).
    // `isLodging` viaja fijo por pantalla vía `meta` (igual que housekeeping
    // usa `meta.date`) — no es algo que el usuario elija, separa las dos
    // pantallas server-side en vez de filtrar en memoria como hasta ahora.
    // Se aplica SIEMPRE, tanto en modo 'server' (lista paginada) como en
    // 'off' (la vista de calendario de Reservas pide todo sin paginar, ver
    // useReservationsScreen — isLodging no depende de la paginación).
    // `from`/`to` (también por `meta`) acotan el 'off' del calendario a la
    // semana visible — sin esto, 'off' traería TODO el historial de
    // alojamiento sin límite (el mismo problema que K2 resolvió, en
    // miniatura). En modo 'server' viajan igual por si algún día la lista
    // suma un filtro de fecha propio — hoy ninguna pantalla lo setea ahí.
    list: async ({ pagination, filters, meta }) => {
      const isLodging = meta?.isLodging as boolean | undefined
      const from       = meta?.from as string | undefined
      const to         = meta?.to as string | undefined
      const status    = getFilterValue(filters, 'status')
      const search    = getFilterValue(filters, 'search')
      if (pagination?.mode !== 'server') return toArray(await reservationsApi.list({ isLodging, status, search, from, to }))
      return toPaginated(await reservationsApi.list({
        page: pagination.currentPage,
        limit: pagination.pageSize,
        status,
        search,
        isLodging,
        from,
        to,
      }))
    },
    getOne: id => reservationsApi.get(id),
    create: data => reservationsApi.create(data as unknown as Parameters<typeof reservationsApi.create>[0]),
    update: (id, data) => reservationsApi.update(id, data as unknown as Parameters<typeof reservationsApi.update>[1]),
    // No hay DELETE de reservas — se cancelan (reservationsApi.cancel),
    // acción con nombre que ReservasPage llama directo, no vía Refine.
    deleteOne: id => notSupported('deleteOne', `reservas/${id}`),
  },
  estadias: {
    // listActive() no acepta filtros — el "meta" no aplica acá todavía.
    list: () => staysApi.listActive(),
    // Sin GET /api/stays/:id individual (sí existe /:id/folio, que es otra cosa).
    getOne: async id => {
      const all = await staysApi.listActive()
      const found = all.find(s => s.id === id)
      if (!found) throw { message: 'Estadía no encontrada', code: 'NOT_FOUND', statusCode: 404, httpStatus: 404 }
      return found
    },
    // "Crear" una estadía es un check-in.
    create: data => staysApi.checkIn(data as unknown as Parameters<typeof staysApi.checkIn>[0]),
    // No hay un "update" genérico de estadía — check-out/no-show son
    // acciones con nombre que EstadiasPage llama directo.
    update: (id) => notSupported('update', `estadias/${id}`),
    deleteOne: id => notSupported('deleteOne', `estadias/${id}`),
  },
  housekeeping: {
    // listByDate requiere la fecha — se pasa por meta.date (useTable la
    // manda desde HousekeepingPage). Sin meta.date, trae todo (el backend
    // trata date=undefined como "sin filtro").
    list: ({ meta }) => housekeepingApi.listByDate(meta?.date as string | undefined),
    getOne: async (id) => {
      throw { message: 'No implementado — housekeeping se consulta por fecha, no por id suelto.', code: 'NOT_FOUND', statusCode: 404, httpStatus: 404, id }
    },
    create: data => housekeepingApi.create(data as unknown as Parameters<typeof housekeepingApi.create>[0]),
    // assign/start/complete/inspect/outOfService/reset son acciones con
    // nombre — HousekeepingPage las llama directo, no vía Refine.
    update: (id) => notSupported('update', `housekeeping/${id}`),
    deleteOne: id => notSupported('deleteOne', `housekeeping/${id}`),
  },
  ordenes: {
    list: () => ordersApi.list(),
    getOne: id => ordersApi.get(id),
    create: data => ordersApi.create(data as unknown as Parameters<typeof ordersApi.create>[0]),
    // confirm/cancel/complete/updateNotes/addItem/removeItem son acciones
    // con nombre — OrdenesPage las llama directo, no vía Refine.
    update: (id) => notSupported('update', `ordenes/${id}`),
    deleteOne: id => notSupported('deleteOne', `ordenes/${id}`),
  },
  'motivos-merma': {
    list: () => wasteReasonsApi.list(),
    // Sin GET /api/waste-reasons/:id individual (sí existe list()).
    getOne: async id => {
      const all = await wasteReasonsApi.list()
      const found = all.find(r => r.id === id)
      if (!found) throw { message: 'Motivo de merma no encontrado', code: 'NOT_FOUND', statusCode: 404, httpStatus: 404 }
      return found
    },
    create: data => wasteReasonsApi.create(data.name as string),
    update: (id, data) => wasteReasonsApi.update(id, data),
    deleteOne: id => wasteReasonsApi.remove(id),
  },
  // 27/08/2026, pendientes-2026-08-27.md — gemelo exacto de 'motivos-merma'.
  'destinos-consumo': {
    list: () => consumptionDestinationsApi.list(),
    // Sin GET /api/consumption-destinations/:id individual (sí existe list()).
    getOne: async id => {
      const all = await consumptionDestinationsApi.list()
      const found = all.find(r => r.id === id)
      if (!found) throw { message: 'Destino de consumo no encontrado', code: 'NOT_FOUND', statusCode: 404, httpStatus: 404 }
      return found
    },
    create: data => consumptionDestinationsApi.create(data.name as string),
    update: (id, data) => consumptionDestinationsApi.update(id, data),
    deleteOne: id => consumptionDestinationsApi.remove(id),
  },
  // L (23/08/2026) — roles propios del negocio (los 5 de fábrica + los
  // custom). `GET /api/roles/:id` sí existe (a diferencia de categorías/
  // recursos/servicios), no hace falta resolver contra el listado.
  roles: {
    list: () => rolesApi.list(),
    getOne: id => rolesApi.get(id),
    create: data => rolesApi.create(data as unknown as Parameters<typeof rolesApi.create>[0]),
    update: (id, data) => rolesApi.update(id, data as unknown as Parameters<typeof rolesApi.update>[1]),
    deleteOne: id => rolesApi.remove(id),
  },
}

function adapterFor(resource: string): ResourceAdapter {
  const adapter = resources[resource]
  if (!adapter) {
    throw new Error(`Recurso "${resource}" sin adaptador en el data provider de Refine todavía.`)
  }
  return adapter
}

// apiFetch (lib/api.ts) rechaza con ApiErrorWithStatus { code, message,
// httpStatus, ...campos por código como plan/limit o errors.fieldErrors }.
// Refine espera HttpError { message, statusCode, errors? }. En vez de
// reemplazar la forma (rompería isPlanLimitError/extractFieldErrors que ya
// usan las pantallas sin migrar), se agrega statusCode como alias de
// httpStatus y se preserva todo lo demás tal cual.
function withStatusCode(err: unknown): unknown {
  if (typeof err === 'object' && err !== null && 'httpStatus' in err && !('statusCode' in err)) {
    return { ...err, statusCode: (err as { httpStatus: number }).httpStatus }
  }
  return err
}

// Casi ningún recurso pagina/filtra/ordena server-side vía Refine — las
// pantallas migradas piden pagination: { mode: 'off' } en useTable y hacen
// su propio filtrado/paginado en cliente (igual que antes de migrar).
// Excepciones, K2 (23/08/2026): Clientes (`dashboard/clientes/page.tsx`) y
// Reservas/Turnos (`hooks/useReservationsScreen.ts`) — ver los adapters
// `clientes`/`reservas`.
export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>({ resource, meta, pagination, filters }: { resource: string; meta?: MetaQuery; pagination?: Pagination; filters?: CrudFilters }) => {
    try {
      const result = await adapterFor(resource).list({ meta, pagination, filters })
      if (Array.isArray(result)) return { data: result as TData[], total: result.length }
      return { data: result.data as TData[], total: result.total }
    } catch (err) {
      throw withStatusCode(err)
    }
  },
  getOne: async <TData extends BaseRecord = BaseRecord>({ resource, id }: { resource: string; id: string | number }) => {
    try {
      const data = await adapterFor(resource).getOne(String(id))
      return { data: data as TData }
    } catch (err) {
      throw withStatusCode(err)
    }
  },
  create: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>({ resource, variables }: { resource: string; variables: TVariables }) => {
    try {
      const data = await adapterFor(resource).create(variables as Record<string, unknown>)
      return { data: data as TData }
    } catch (err) {
      throw withStatusCode(err)
    }
  },
  update: async <TData extends BaseRecord = BaseRecord, TVariables = Record<string, unknown>>({ resource, id, variables }: { resource: string; id: string | number; variables: TVariables }) => {
    try {
      const data = await adapterFor(resource).update(String(id), variables as Record<string, unknown>)
      return { data: data as TData }
    } catch (err) {
      throw withStatusCode(err)
    }
  },
  deleteOne: async <TData extends BaseRecord = BaseRecord>({ resource, id }: { resource: string; id: string | number }) => {
    try {
      await adapterFor(resource).deleteOne(String(id))
      return { data: { id } as TData }
    } catch (err) {
      throw withStatusCode(err)
    }
  },
  // Cada llamada ya sale de lib/api.ts con su propia ruta absoluta — no hay
  // una URL base genérica que construir acá.
  getApiUrl: () => '',
}
