'use client'
import { useState, useEffect, useMemo } from 'react'
import { useTable, useCreate, useUpdate, useInvalidate } from '@refinedev/core'
import { reservationsApi, resourcesApi, bookableServicesApi, categoriesApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { Reservation, Resource, ReservationStatus, BookableService, Category } from '@/lib/types'

/**
 * Motor compartido de Reservas y Turnos (Fase 4, docs/auditoria-modularidad.md,
 * hallazgo F4) — la parte de las dos pantallas que era código idéntico,
 * copiado y pegado: traer recursos/servicios/categorías, filtrar por
 * `isLodging`, listar/buscar/paginar reservas, y las tres acciones de
 * ciclo de vida (confirmar/cancelar/completar).
 *
 * A propósito NO incluye el formulario de alta ni el de edición del
 * detalle — esos dos siguen siendo el código más distinto entre las dos
 * pantallas (Reservas tiene adultos/niños, tarifas, calendario y horario
 * especial; Turnos no) y fusionarlos era el riesgo más alto de la Fase 4.
 * Cada pantalla los sigue teniendo propios.
 *
 * @param isLodging `true` para Reservas (alojamiento), `false` para
 *   Turnos (todo lo demás) — mismo filtro que ya regía cada pantalla por
 *   separado desde E1 (13/08/2026).
 * @param paginationMode `'server'` (default) pagina de a 20 — la vista de
 *   lista. `'off'` trae TODO lo que matchea el filtro sin paginar — lo
 *   necesita la vista de calendario de Reservas (`RoomCalendar` dibuja
 *   barras sobre un rango de fechas, no sobre "una página de 20"; con
 *   paginación server-side ya no puede reusar el mismo array que la
 *   lista). Turnos no tiene calendario, siempre usa 'server'. Cambiar este
 *   valor reactivamente (ej. al togglear la vista) reusa el mismo
 *   `useTable` — Refine dispara un nuevo fetch solo, sin duplicar la
 *   lógica de invalidación de create/update/confirm/cancel/completar.
 * @param dateRange Acota `'off'` a la semana visible del calendario — sin
 *   esto, `mode: 'off'` traería TODO el historial de alojamiento sin
 *   límite (mismo problema estructural que K2 resolvió para la lista,
 *   reintroducido en miniatura). `undefined` = sin acotar (Turnos no lo
 *   usa; tampoco tiene sentido combinarlo con `paginationMode: 'server'`,
 *   la lista pagina, no navega por semana).
 */
export function useReservationsScreen(
  isLodging: boolean,
  paginationMode: 'server' | 'off' = 'server',
  dateRange?: { from: string; to: string },
) {
  const { toast } = useToast()
  // K2 (23/08/2026) — paginación/filtrado server-side. `isLodging`/`from`/`to`
  // viajan fijos por pantalla vía `meta` (Reservas=true, Turnos=false) y es
  // lo que separa las dos vistas en el backend ahora (antes era 100%
  // client-side, filtrando `screenResourceIds` sobre la lista completa).
  // status/search viajan como filtros Refine (ver el efecto debounced más
  // abajo).
  const {
    result, tableQuery,
    currentPage, setCurrentPage, pageCount,
    setFilters,
  } = useTable<Reservation>({
    resource: 'reservas',
    pagination: { mode: paginationMode, pageSize: 20 },
    meta: { isLodging, from: dateRange?.from, to: dateRange?.to },
  })
  const reservations = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createReservation } = useCreate<Reservation>()
  const { mutateAsync: updateReservation } = useUpdate<Reservation>()
  // confirm/cancel/complete son acciones con nombre (reservationsApi[action])
  // que no pasan por el data provider — invalidate() fuerza el refetch de
  // la lista después, igual que create/update lo hacen solos vía Refine.
  const invalidate = useInvalidate()

  const [resources, setResources] = useState<Resource[]>([])
  const [services, setServices] = useState<BookableService[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<ReservationStatus | ''>('')

  // Recursos/servicios no están migrados a Refine — se siguen trayendo
  // directo, igual que antes en las dos pantallas. Ya no se usan para
  // filtrar la lista (eso lo resuelve el backend con `isLodging`), solo
  // para resolver nombres y para el formulario de alta.
  useEffect(() => {
    queueMicrotask(() => {
      Promise.all([resourcesApi.list(), bookableServicesApi.list(), categoriesApi.list()])
        .then(([recs, svcs, cats]) => { setResources(recs); setServices(svcs); setCategories(cats) })
        .catch(err => toast(extractErrorMessage(err), 'error'))
    })
  }, [toast])

  const screenCategoryIds = useMemo(
    () => new Set(categories.filter(c => c.isLodging === isLodging).map(c => c.id)),
    [categories, isLodging],
  )
  const screenResources = useMemo(
    () => resources.filter(r => screenCategoryIds.has(r.categoryId)),
    [resources, screenCategoryIds],
  )
  const screenResourceIds = useMemo(
    () => new Set(screenResources.map(r => r.id)),
    [screenResources],
  )
  const screenServices = useMemo(
    () => services.filter(s => screenCategoryIds.has(s.categoryId)),
    [services, screenCategoryIds],
  )

  // El backend ya devuelve la página filtrada (isLodging/status/search) —
  // no hay más filtrado/paginado en memoria acá.
  const filtered = reservations
  const paginated = reservations
  const page = currentPage
  const setPage = setCurrentPage
  const totalPages = pageCount

  // Debounce de 400ms (mismo criterio que Clientes, K2) — status/search
  // ahora disparan un fetch al backend, no un filtro en memoria instantáneo.
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      setFilters([
        { field: 'search', operator: 'contains', value: search.trim() || undefined },
        { field: 'status', operator: 'eq', value: filterStatus || undefined },
      ])
    }, 400)
    return () => clearTimeout(timer)
  }, [search, filterStatus, setCurrentPage, setFilters])

  /** @param entityLabel — "Reserva"/"Turno", para el texto de los toasts. */
  async function doAction(id: string, action: 'confirm' | 'cancel' | 'complete', entityLabel: string) {
    setActionLoading(`${id}-${action}`)
    try {
      await reservationsApi[action](id)
      const labels = {
        confirm:  `${entityLabel} confirmad${entityLabel === 'Reserva' ? 'a' : 'o'}`,
        cancel:   `${entityLabel} cancelad${entityLabel === 'Reserva' ? 'a' : 'o'}`,
        complete: `${entityLabel} completad${entityLabel === 'Reserva' ? 'a' : 'o'}`,
      }
      toast(labels[action], 'success')
      invalidate({ resource: 'reservas', invalidates: ['list'] })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const getResourceName = (id: string) =>
    resources.find(r => r.id === id)?.name ?? id.slice(0, 8) + '…'

  const getServiceName = (id?: string | null) =>
    id ? services.find(s => s.id === id)?.name ?? id.slice(0, 8) + '…' : null

  return {
    reservations, loading,
    createReservation, updateReservation, invalidate,
    resources, services, categories,
    screenCategoryIds, screenResources, screenResourceIds, screenServices,
    search, setSearch, filterStatus, setFilterStatus,
    page, setPage, totalPages, paginated, filtered,
    // Total real del backend — `filtered.length` es solo el tamaño de la
    // página actual (≤20) desde que la paginación es server-side (K2).
    total: result.total ?? reservations.length,
    actionLoading, setActionLoading, doAction,
    getResourceName, getServiceName,
  }
}

/** input datetime-local necesita "YYYY-MM-DDTHH:mm", sin segundos ni Z — idéntico en Reservas y Turnos. */
export function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Turnos disponibles de un servicio "slot" con horario configurado —
 * idéntico en Reservas y Turnos (mismo endpoint, mismo criterio de "si no
 * hay horario configurado, [] y se cae al datetime-local libre").
 */
export function useAvailableSlots(isSlotService: boolean, serviceId: string, resourceId: string, slotDate: string) {
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      if (!isSlotService || !resourceId || !slotDate) {
        setAvailableSlots(null)
        return
      }
      setLoadingSlots(true)
      bookableServicesApi.getAvailableSlots(serviceId, resourceId, slotDate)
        .then(res => setAvailableSlots(res.slots))
        .catch(() => setAvailableSlots([]))
        .finally(() => setLoadingSlots(false))
    })
  }, [isSlotService, serviceId, resourceId, slotDate])

  return { availableSlots, setAvailableSlots, loadingSlots }
}
