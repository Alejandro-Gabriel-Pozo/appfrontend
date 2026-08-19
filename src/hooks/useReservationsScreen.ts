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
 */
export function useReservationsScreen(isLodging: boolean) {
  const { toast } = useToast()
  // Mismo recurso Refine 'reservas' en las dos pantallas — la separación
  // es 100% filtrado client-side por categoría, no un recurso de backend
  // distinto (es la misma entidad Reservation para ambos paneles).
  const { result, tableQuery } = useTable<Reservation>({ resource: 'reservas', pagination: { mode: 'off' } })
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
  const [page, setPage] = useState(1)

  // Recursos/servicios no están migrados a Refine — se siguen trayendo
  // directo, igual que antes en las dos pantallas.
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

  // Filtrado y paginación en cliente
  const filtered = useMemo(() => {
    let list = reservations.filter(r => screenResourceIds.has(r.resourceId))
    if (filterStatus) list = list.filter(r => r.status === filterStatus)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r =>
        r.customer.fullName?.toLowerCase().includes(q) ||
        r.customer.email?.toLowerCase().includes(q)
      )
    }
    return list
  }, [reservations, screenResourceIds, filterStatus, search])

  const PAGE_SIZE = 20
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { queueMicrotask(() => setPage(1)) }, [search, filterStatus])

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
