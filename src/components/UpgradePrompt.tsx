'use client'
/**
 * UpgradePrompt — Banner que se muestra cuando el backend responde
 * con code: 'PLAN_LIMIT_REACHED' (HTTP 402).
 *
 * NO hardcodea plan ni limit: los recibe directamente del error del backend.
 *
 * Uso:
 *   const [limitErr, setLimitErr] = useState<PlanLimitPayload | null>(null)
 *
 *   catch (err) {
 *     if (isPlanLimitError(err)) setLimitErr({ plan: err.plan, limit: err.limit, resource: 'categorías' })
 *   }
 *
 *   {limitErr && <UpgradePrompt {...limitErr} onDismiss={() => setLimitErr(null)} />}
 */
import type { FC } from 'react'

export interface PlanLimitPayload {
  plan:     string   // ej: 'FREE', 'STARTER' — viene del backend
  limit:    number   // ej: 1 — viene del backend
  resource: string   // ej: 'categorías' — lo define el componente que llama
}

interface UpgradePromptProps extends PlanLimitPayload {
  onDismiss?: () => void
}

const UpgradePrompt: FC<UpgradePromptProps> = ({ plan, limit, resource, onDismiss }) => {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900"
    >
      {/* Ícono warning */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>

      <div className="flex-1">
        <p>
          Tu plan{' '}
          <strong className="font-semibold">{plan}</strong>{' '}
          permite hasta{' '}
          <strong className="font-semibold">{limit}</strong>{' '}
          {resource}.
        </p>
        <a
          href="/settings/billing"
          className="mt-2 inline-block font-medium underline underline-offset-2 hover:text-yellow-700"
        >
          Actualizá tu plan →
        </a>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar"
          className="ml-auto shrink-0 rounded p-1 hover:bg-yellow-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

export default UpgradePrompt
