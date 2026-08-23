type SignalState = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'active'

const BADGE_CLASS: Record<SignalState, string> = {
  pending: 'badge-pending',
  confirmed: 'badge-confirmed',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
  active: 'badge-active',
}

/** Etiqueta de estado con punto de señal — nunca depende solo del color,
 * siempre lleva el texto (guía ZULU §5: SignalBadge). */
export default function SignalBadge({ state, label }: { state: SignalState; label: string }) {
  return (
    <span className={BADGE_CLASS[state]}>
      <i className={`signal-dot${state === 'active' ? ' signal-dot-active' : ''}`} />
      {label}
    </span>
  )
}
