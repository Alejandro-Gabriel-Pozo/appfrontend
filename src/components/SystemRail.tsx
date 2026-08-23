'use client'
import { useEffect, useState } from 'react'
import { systemApi } from '@/lib/api'

type RailState = 'healthy' | 'attention'

const RAIL_LABEL: Record<RailState, string> = {
  healthy: 'SINCRONIZADO',
  attention: 'REQUIERE REVISIÓN',
}

/** Línea de estado del header (guía ZULU §5: SystemRail) — refleja datos
 * reales del outbox (mismo endpoint que ya usa OutboxAlertBanner), no es
 * decorativo. Sin permiso de management no hay forma de ver el detalle
 * (mismo gate que el banner), así que se muestra siempre "saludable". */
export default function SystemRail({ isManagement }: { isManagement: boolean }) {
  const [state, setState] = useState<RailState>('healthy')
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isManagement) return
    systemApi.getDeadLetter()
      .then(({ events }) => {
        setState(events.length > 0 ? 'attention' : 'healthy')
        setCount(events.length)
      })
      .catch(() => { /* sin datos, el rail se queda en estado saludable por defecto */ })
  }, [isManagement])

  const detail = state === 'attention' ? ` / ${count} EVENTO${count === 1 ? '' : 'S'}` : ''

  return (
    <div className={`system-rail system-rail-${state}`}>
      <i />
      <span>{RAIL_LABEL[state]}{detail}</span>
    </div>
  )
}
