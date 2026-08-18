'use client'
import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Resource, Reservation, ReservationStatus, BookableService } from '@/lib/types'

// ─── Calendario de PMS (tape chart) — construido a medida, sin librería ─────
// Filas = habitaciones (recursos de alojamiento), columnas = días, barras =
// reservas. Pedido explícito del dueño tras revisar QloApps (que NO tiene
// esto — solo un mini-calendario de disponibilidad tipo mapa de calor, sin
// filas por habitación ni drag) y decidir construirlo propio en vez de pagar
// la licencia de FullCalendar Premium (US$480/año, resource-timeline).
//
// Convención de fechas: una reserva de alojamiento se crea con
// `new Date('YYYY-MM-DD').toISOString()` (ver dashboard/reservas/page.tsx,
// rama isBlockBooking) — eso es SIEMPRE medianoche UTC exacta para ese día
// calendario. Todo el math de este componente usa getters UTC para
// recuperar ese día exacto, nunca getters locales — mismo motivo que el fix
// del bug de housekeeping (18/08/2026): un getter local depende del huso del
// proceso que corre el código, uno UTC no.

const DAY_WIDTH = 140
const ROW_HEIGHT = 56
const RESOURCE_COL_WIDTH = 160
const VISIBLE_DAYS = 7
const MS_PER_DAY = 86_400_000

const STATUS_BAR_STYLE: Record<Exclude<ReservationStatus, 'CANCELLED'>, { bg: string; border: string; text: string }> = {
  PENDING:   { bg: 'var(--bastion-brass-soft)', border: 'var(--bastion-brass)', text: 'var(--bastion-brass)' },
  CONFIRMED: { bg: 'var(--bastion-sage-bg)',    border: 'var(--bastion-sage)',  text: 'var(--bastion-sage)' },
  COMPLETED: { bg: 'var(--bastion-neutral-bg)', border: '#C7CCDA',             text: 'var(--bastion-neutral-text)' },
}

function todayUTCMidnightMs(): number {
  const now = new Date()
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Día calendario (medianoche UTC) que representa un instante ISO — ver nota de convención arriba. */
function utcMidnightMs(iso: string): number {
  const d = new Date(iso)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function dayIndex(iso: string, weekStartMs: number): number {
  return Math.round((utcMidnightMs(iso) - weekStartMs) / MS_PER_DAY)
}

function msAtDayOffset(baseMs: number, days: number): number {
  return baseMs + days * MS_PER_DAY
}

function msToDate(ms: number): Date {
  return new Date(ms)
}

// Tooltip enriquecido (18/08/2026, spec de mejoras PMS, ticket #3 —
// docs/referencia-mejoras-pms-2026-08-18.md sección 3.2). "Origen de la
// reserva" queda deliberadamente FUERA: no existe ese dato en el backend
// hoy (el propio anexo lo marca "A confirmar", no es un campo ya
// decidido) — inventar un valor acá sería mostrar algo que no es real.
// "Tarifa/producto" se interpreta con lo que sí existe: totalPrice y el
// nombre del servicio si la reserva tiene uno.
const fmtTooltipDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmtTooltipMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format

function fmtDayHeader(ms: number): { weekday: string; day: string } {
  const d = new Date(ms)
  return {
    weekday: d.toLocaleDateString('es-AR', { weekday: 'short', timeZone: 'UTC' }),
    day: d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  }
}

interface DragSession {
  reservationId: string
  mode: 'move' | 'resize-start' | 'resize-end'
  startX: number
  startY: number
  originStartIdx: number
  originEndIdx: number
  originRowIndex: number
}

interface DragPreview {
  reservationId: string
  startIdx: number
  endIdx: number
  rowIndex: number
}

export default function RoomCalendar({
  resources,
  reservations,
  services = [],
  onReservationClick,
  onEmptySlotClick,
  onUpdated,
}: {
  resources: Resource[]
  reservations: Reservation[]
  /** Para resolver el nombre del servicio en el tooltip enriquecido — opcional, sin servicios el tooltip simplemente no muestra esa línea. */
  services?: BookableService[]
  onReservationClick: (r: Reservation) => void
  onEmptySlotClick: (resourceId: string, date: Date) => void
  onUpdated: (id: string, changes: { startTime?: string; endTime?: string; resourceId?: string }) => void
}) {
  const [weekStartMs, setWeekStartMs] = useState(todayUTCMidnightMs)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const dragSessionRef = useRef<DragSession | null>(null)
  // Espejo de dragPreview vía ref -- handleUp necesita el valor MÁS
  // reciente para decidir qué hacer, pero no puede leerlo con
  // setDragPreview(prev => ...) porque adentro llama a setState de OTRO
  // componente (onReservationClick/onUpdated → props del padre), y React
  // prohíbe eso dentro del updater de un setState (ver warning "Cannot
  // update a component while rendering a different component").
  const dragPreviewRef = useRef<DragPreview | null>(null)
  // pointerdown+pointerup sin mover el mouse igual dispara "click" del
  // navegador — sin esto, terminar un drag real (que sí movió el puntero)
  // abriría también el modal de detalle por accidente.
  const hasMovedRef = useRef(false)

  const days = useMemo(
    () => Array.from({ length: VISIBLE_DAYS }, (_, i) => msAtDayOffset(weekStartMs, i)),
    [weekStartMs],
  )

  // CANCELLED no ocupa lugar real — no se dibuja en el tape chart (mismo
  // criterio que cualquier PMS: una reserva cancelada libera la habitación).
  const visibleReservations = useMemo(
    () => reservations.filter(r => r.status !== 'CANCELLED'),
    [reservations],
  )

  function beginDrag(e: React.PointerEvent, reservation: Reservation, rowIndex: number, mode: DragSession['mode']) {
    e.stopPropagation()
    e.preventDefault()
    hasMovedRef.current = false
    const startIdx = dayIndex(reservation.startTime, weekStartMs)
    const endIdx = dayIndex(reservation.endTime, weekStartMs)
    dragSessionRef.current = {
      reservationId: reservation.id, mode,
      startX: e.clientX, startY: e.clientY,
      originStartIdx: startIdx, originEndIdx: endIdx, originRowIndex: rowIndex,
    }
    const initialPreview = { reservationId: reservation.id, startIdx, endIdx, rowIndex }
    dragPreviewRef.current = initialPreview
    setDragPreview(initialPreview)
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging) return

    function handleMove(e: PointerEvent) {
      const s = dragSessionRef.current
      if (!s) return
      if (Math.abs(e.clientX - s.startX) > 4 || Math.abs(e.clientY - s.startY) > 4) hasMovedRef.current = true

      const dxDays = Math.round((e.clientX - s.startX) / DAY_WIDTH)
      const dyRows = Math.round((e.clientY - s.startY) / ROW_HEIGHT)

      let newStart = s.originStartIdx
      let newEnd = s.originEndIdx
      let newRow = s.originRowIndex

      if (s.mode === 'move') {
        newStart = s.originStartIdx + dxDays
        newEnd = s.originEndIdx + dxDays
        newRow = Math.min(resources.length - 1, Math.max(0, s.originRowIndex + dyRows))
      } else if (s.mode === 'resize-start') {
        newStart = Math.min(s.originEndIdx - 1, s.originStartIdx + dxDays)
      } else {
        newEnd = Math.max(s.originStartIdx + 1, s.originEndIdx + dxDays)
      }

      const nextPreview = { reservationId: s.reservationId, startIdx: newStart, endIdx: newEnd, rowIndex: newRow }
      dragPreviewRef.current = nextPreview
      setDragPreview(nextPreview)
    }

    function handleUp() {
      const s = dragSessionRef.current
      const preview = dragPreviewRef.current
      dragSessionRef.current = null
      dragPreviewRef.current = null
      setIsDragging(false)
      setDragPreview(null)

      if (!s || !preview) return

      // preventDefault() en pointerdown (necesario para que arrastrar no
      // dispare selección de texto) suprime el "click" nativo del
      // navegador -- por eso la distinción click-vs-drag se resuelve acá
      // a mano, no con un onClick del lado del <div> de la barra.
      if (!hasMovedRef.current) {
        const reservation = reservations.find(r => r.id === s.reservationId)
        if (reservation) onReservationClick(reservation)
        return
      }

      const changed =
        preview.startIdx !== s.originStartIdx ||
        preview.endIdx !== s.originEndIdx ||
        preview.rowIndex !== s.originRowIndex
      if (changed) {
        const changes: { startTime?: string; endTime?: string; resourceId?: string } = {}
        if (preview.startIdx !== s.originStartIdx) changes.startTime = msToDate(msAtDayOffset(weekStartMs, preview.startIdx)).toISOString()
        if (preview.endIdx !== s.originEndIdx) changes.endTime = msToDate(msAtDayOffset(weekStartMs, preview.endIdx)).toISOString()
        if (preview.rowIndex !== s.originRowIndex) {
          const target = resources[preview.rowIndex]
          if (target) changes.resourceId = target.id
        }
        onUpdated(s.reservationId, changes)
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [isDragging, resources, weekStartMs, onUpdated, reservations, onReservationClick])

  const gridWidth = VISIBLE_DAYS * DAY_WIDTH

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Navegación de semana */}
      <div className="flex items-center justify-between p-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStartMs(ms => ms - VISIBLE_DAYS * MS_PER_DAY)} className="btn-secondary" style={{ padding: '6px 12px' }}>
            ← Semana anterior
          </button>
          <button onClick={() => setWeekStartMs(todayUTCMidnightMs())} className="btn-secondary" style={{ padding: '6px 12px' }}>
            Hoy
          </button>
          <button onClick={() => setWeekStartMs(ms => ms + VISIBLE_DAYS * MS_PER_DAY)} className="btn-secondary" style={{ padding: '6px 12px' }}>
            Semana siguiente →
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Arrastrá una reserva para cambiarla de fecha u habitación · estirá el borde para cambiar noches
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: RESOURCE_COL_WIDTH + gridWidth }}>
          {/* Header de días */}
          <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: RESOURCE_COL_WIDTH, flexShrink: 0 }} />
            {days.map(ms => {
              const { weekday, day } = fmtDayHeader(ms)
              const isToday = ms === todayUTCMidnightMs()
              return (
                <div
                  key={ms}
                  style={{
                    width: DAY_WIDTH, flexShrink: 0, textAlign: 'center', padding: '8px 4px',
                    background: isToday ? 'var(--bastion-brass-soft)' : undefined,
                  }}
                >
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>{weekday}</p>
                  <p className="text-sm mono" style={{ color: 'var(--text-primary)', fontWeight: isToday ? 600 : 400 }}>{day}</p>
                </div>
              )
            })}
          </div>

          {/* Filas por recurso */}
          {resources.length === 0 ? (
            <div className="empty-state" style={{ padding: 32 }}>
              <p>No hay habitaciones para mostrar — marcá una categoría como alojamiento en Categorías.</p>
            </div>
          ) : (
            resources.map((resource, rowIndex) => {
              const rowReservations = visibleReservations.filter(r => {
                // Mientras se arrastra ESTA reserva a otra fila, desaparece de
                // su fila de origen (reaparece como preview en la fila destino).
                if (dragPreview?.reservationId === r.id) return false
                return r.resourceId === resource.id
              })

              return (
                <div key={resource.id} className="flex" style={{ borderBottom: '1px solid var(--border)', position: 'relative' }}>
                  <div
                    style={{
                      width: RESOURCE_COL_WIDTH, flexShrink: 0, padding: '0 12px',
                      display: 'flex', alignItems: 'center',
                      fontSize: 13, color: 'var(--text-primary)', fontWeight: 500,
                      background: 'var(--surface-4)', position: 'sticky', left: 0, zIndex: 2,
                    }}
                  >
                    {resource.name}
                  </div>

                  <div style={{ position: 'relative', width: gridWidth, height: ROW_HEIGHT, flexShrink: 0 }}>
                    {/* Celdas clickeables (fondo) — una por día */}
                    {days.map((ms, i) => (
                      <div
                        key={ms}
                        onClick={() => onEmptySlotClick(resource.id, msToDate(ms))}
                        style={{
                          position: 'absolute', left: i * DAY_WIDTH, top: 0, width: DAY_WIDTH, height: ROW_HEIGHT,
                          borderLeft: i > 0 ? '1px solid var(--border)' : undefined,
                          cursor: 'pointer',
                        }}
                      />
                    ))}

                    {/* Barras de reserva de esta fila */}
                    {rowReservations.map(r => {
                      const startIdx = dayIndex(r.startTime, weekStartMs)
                      const endIdx = dayIndex(r.endTime, weekStartMs)
                      if (endIdx <= 0 || startIdx >= VISIBLE_DAYS) return null // fuera de la semana visible
                      const visStart = Math.max(0, startIdx)
                      const visEnd = Math.min(VISIBLE_DAYS, endIdx)
                      const style = STATUS_BAR_STYLE[r.status as Exclude<ReservationStatus, 'CANCELLED'>] ?? STATUS_BAR_STYLE.PENDING
                      return (
                        <ReservationBar
                          key={r.id}
                          reservation={r}
                          services={services}
                          left={visStart * DAY_WIDTH}
                          width={(visEnd - visStart) * DAY_WIDTH}
                          truncatedStart={startIdx < 0}
                          truncatedEnd={endIdx > VISIBLE_DAYS}
                          style={style}
                          onBeginDrag={(e, mode) => beginDrag(e, r, rowIndex, mode)}
                        />
                      )
                    })}

                    {/* Ghost de la reserva en arrastre, si esta fila es el destino actual */}
                    {dragPreview && dragPreview.rowIndex === rowIndex && dragPreview.endIdx > 0 && dragPreview.startIdx < VISIBLE_DAYS && (() => {
                      const r = reservations.find(x => x.id === dragPreview.reservationId)
                      if (!r) return null
                      const visStart = Math.max(0, dragPreview.startIdx)
                      const visEnd = Math.min(VISIBLE_DAYS, dragPreview.endIdx)
                      const style = STATUS_BAR_STYLE[r.status as Exclude<ReservationStatus, 'CANCELLED'>] ?? STATUS_BAR_STYLE.PENDING
                      return (
                        <div
                          style={{
                            position: 'absolute', left: visStart * DAY_WIDTH, top: 4,
                            width: Math.max(1, visEnd - visStart) * DAY_WIDTH, height: ROW_HEIGHT - 8,
                            borderRadius: 8, border: `2px dashed ${style.border}`, background: style.bg,
                            opacity: 0.85, pointerEvents: 'none', zIndex: 5,
                            display: 'flex', alignItems: 'center', padding: '0 8px',
                          }}
                        >
                          <span className="text-xs" style={{ color: style.text, fontWeight: 600 }}>{r.customer.fullName ?? 'Reserva'}</span>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Barra de reserva individual ────────────────────────────────────────────
function ReservationBar({
  reservation, services, left, width, truncatedStart, truncatedEnd, style, onBeginDrag,
}: {
  reservation: Reservation
  services: BookableService[]
  left: number
  width: number
  truncatedStart: boolean
  truncatedEnd: boolean
  style: { bg: string; border: string; text: string }
  onBeginDrag: (e: React.PointerEvent, mode: 'move' | 'resize-start' | 'resize-end') => void
}) {
  const barRef = useRef<HTMLDivElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)

  // Portal a document.body (no un div hijo posicionado con top:100%) porque
  // el contenedor del calendario tiene overflow:hidden/overflow-x:auto en
  // varios niveles — un tooltip anidado se recortaría en las filas de arriba
  // o abajo. position:fixed + coordenadas del propio bounding rect evita el
  // recorte sin importar dónde esté la barra en la grilla.
  function showTooltip() {
    const rect = barRef.current?.getBoundingClientRect()
    if (rect) setTooltipPos({ top: rect.top, left: rect.left + rect.width / 2 })
  }

  const serviceName = reservation.serviceId ? services.find(s => s.id === reservation.serviceId)?.name : null

  return (
    <div
      ref={barRef}
      onPointerDown={e => {
        const target = e.target as HTMLElement
        if (target.dataset['handle'] === 'start') { onBeginDrag(e, 'resize-start'); return }
        if (target.dataset['handle'] === 'end') { onBeginDrag(e, 'resize-end'); return }
        onBeginDrag(e, 'move')
      }}
      onPointerEnter={showTooltip}
      onPointerLeave={() => setTooltipPos(null)}
      style={{
        position: 'absolute', left, top: 4, width, height: ROW_HEIGHT - 8,
        background: style.bg, border: `1px solid ${style.border}`,
        borderTopLeftRadius: truncatedStart ? 2 : 8, borderBottomLeftRadius: truncatedStart ? 2 : 8,
        borderTopRightRadius: truncatedEnd ? 2 : 8, borderBottomRightRadius: truncatedEnd ? 2 : 8,
        display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4,
        cursor: 'grab', zIndex: 3, overflow: 'hidden',
      }}
    >
      {!truncatedStart && (
        <div data-handle="start" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
      )}
      <span className="text-xs" style={{ color: style.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {reservation.customer.fullName ?? 'Reserva'}
      </span>
      {!truncatedEnd && (
        <div data-handle="end" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }} />
      )}
      {tooltipPos && typeof document !== 'undefined' && createPortal(
        <ReservationTooltip reservation={reservation} serviceName={serviceName} pos={tooltipPos} />,
        document.body,
      )}
    </div>
  )
}

// Tooltip enriquecido (18/08/2026, spec de mejoras PMS ticket #3) — todos
// los campos que pide el anexo y SÍ existen en el modelo hoy (huésped,
// check-in/out, adultos/niños, notas, precio/servicio). "Origen de la
// reserva" queda afuera a propósito, ver comentario de fmtTooltipDate.
function ReservationTooltip({ reservation, serviceName, pos }: { reservation: Reservation; serviceName: string | null | undefined; pos: { top: number; left: number } }) {
  return (
    <div
      style={{
        position: 'fixed', top: pos.top, left: pos.left, transform: 'translate(-50%, calc(-100% - 8px))',
        background: 'var(--surface-2, #1a1d27)', border: '1px solid var(--border)', borderRadius: 8,
        padding: '10px 12px', minWidth: 200, maxWidth: 260,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)', zIndex: 1000, pointerEvents: 'none',
      }}
    >
      <p className="text-sm" style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
        {reservation.customer.fullName ?? 'Reserva'}
      </p>
      <div className="text-xs" style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>Check-in: {fmtTooltipDate(reservation.startTime)}</span>
        <span>Check-out: {fmtTooltipDate(reservation.endTime)}</span>
        {reservation.adultos != null && (
          <span>Adultos: {reservation.adultos} · Niños: {reservation.ninos ?? 0}</span>
        )}
        {serviceName && <span>Servicio: {serviceName}</span>}
        <span>Tarifa: {fmtTooltipMoney(reservation.totalPrice)}</span>
        {reservation.notes && <span>Notas: {reservation.notes}</span>}
      </div>
    </div>
  )
}
