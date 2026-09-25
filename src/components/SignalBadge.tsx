type SignalState = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'active' | 'unassigned'

const BADGE_CLASS: Record<SignalState, string> = {
  pending: 'badge-pending',
  confirmed: 'badge-confirmed',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
  active: 'badge-active',
  // 25/09/2026 (v11/Fase 1) — ver el docblock de `.badge-unassigned` en
  // globals.css: eje independiente de status, deliberadamente distinto de
  // `badge-pending` aunque las dos coincidan seguido.
  unassigned: 'badge-unassigned',
}

/** Etiqueta de estado con punto de señal — nunca depende solo del color,
 * siempre lleva el texto (guía ZULU §5: SignalBadge). */
export default function SignalBadge({ state, label }: { state: SignalState; label: string }) {
  return (
    <span className={BADGE_CLASS[state]}>
      <i className={`signal-dot${state === 'active' ? ' signal-dot-active' : ''}${state === 'unassigned' ? ' signal-dot-outline' : ''}`} />
      {label}
    </span>
  )
}
