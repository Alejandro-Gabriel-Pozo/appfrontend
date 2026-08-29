'use client'
import { useState, useRef } from 'react'
import { apiFetch } from '@/lib/api'

type InputDef = {
  key: string
  label: string
  type?: 'text' | 'email' | 'password' | 'number' | 'datetime-local'
  placeholder?: string
  options?: string[]
  required?: boolean
}

type Props = {
  method: 'GET' | 'POST' | 'DELETE'
  label: string
  buildUrl: (values: Record<string, string>) => string
  buildBody?: (values: Record<string, string>) => unknown
  inputs?: InputDef[]
  noAuth?: boolean
  onToken?: (token: string) => void
}

const METHOD_BADGE: Record<string, string> = {
  GET:    'badge-get',
  POST:   'badge-active',
  DELETE: 'badge-cancelled',
}

const BTN_COLOR: Record<string, string> = {
  GET:    'btn-secondary',
  POST:   'btn-primary',
  DELETE: 'btn-danger',
}

export default function ApiBlock({
  method, label, buildUrl, buildBody, inputs = [], onToken,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{ status: number; body: unknown } | null>(null)
  const vals = useRef<Record<string, string>>({})
  const [, forceUpdate] = useState(0)

  const hasInputs = inputs.length > 0

  async function run() {
    setLoading(true)
    setResponse(null)
    try {
      const path = buildUrl(vals.current).replace(/^https?:\/\/[^/]+/, '')
      const body = await apiFetch<unknown>(path, {
        method,
        ...(buildBody && method !== 'GET' && {
          body: JSON.stringify(buildBody(vals.current)),
        }),
      })
      if (onToken && typeof body === 'object' && body !== null && 'token' in body) {
        onToken((body as Record<string, string>).token)
      }
      setResponse({ status: 200, body })
    } catch (e: unknown) {
      const err = e as { httpStatus?: number; message?: string }
      setResponse({ status: err.httpStatus ?? 0, body: e })
    } finally {
      setLoading(false)
    }
  }

  function handleClick() {
    if (hasInputs && !open) { setOpen(true); return }
    run()
  }

  return (
    <div className="card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold shrink-0 ${METHOD_BADGE[method]}`}>
            {method}
          </span>
          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{label}</span>
        </div>
        <button
          onClick={handleClick}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold
            transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shrink-0
            ${BTN_COLOR[method]}`}
        >
          {loading ? (
            <>
              <span className="spinner w-3 h-3" />
              Cargando
            </>
          ) : hasInputs && !open ? 'Configurar' : 'Ejecutar'}
        </button>
      </div>

      {/* Collapsible form */}
      {hasInputs && open && (
        <div className="px-4 pb-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          {inputs.map(inp => (
            <div key={inp.key} className={inp.type === 'datetime-local' ? 'sm:col-span-1' : ''}>
              <label className="label">
                {inp.label}{inp.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {inp.options ? (
                <select
                    className="input"
                  defaultValue=""
                  onChange={e => { vals.current[inp.key] = e.target.value; forceUpdate(n => n + 1) }}
                >
                  <option value="" disabled>Seleccionar…</option>
                  {inp.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={inp.type ?? 'text'}
                  placeholder={inp.placeholder}
                  className="input"
                  onChange={e => { vals.current[inp.key] = e.target.value }}
                />
              )}
            </div>
          ))}
          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
            <button
              onClick={run}
              disabled={loading}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                transition-all duration-150 disabled:opacity-50 ${BTN_COLOR[method]}`}
            >
              {loading ? (
                <><span className="spinner w-3.5 h-3.5" />Ejecutando…</>
              ) : 'Ejecutar'}
            </button>
            <button
              onClick={() => { setOpen(false); setResponse(null) }}
              className="btn-ghost px-3 py-2 text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Response block */}
      {response && (
        <div className={`response-block mx-4 mb-4 ${response.status >= 400 || response.status === 0 ? 'error' : ''}`}>
          <div className="mb-2 font-bold text-[11px] uppercase tracking-wide" style={{ color: response.status >= 400 || response.status === 0 ? 'var(--danger)' : 'var(--zulu-technical)' }}>
            {response.status === 0 ? 'Error de red' : `HTTP ${response.status}`}
          </div>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(response.body, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
