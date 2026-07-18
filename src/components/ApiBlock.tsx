'use client'
import { useState, useRef } from 'react'

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
  GET:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  POST:   'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  DELETE: 'bg-red-500/15 text-red-400 border border-red-500/25',
}

const BTN_COLOR: Record<string, string> = {
  GET:    'bg-emerald-600 hover:bg-emerald-500',
  POST:   'bg-blue-600 hover:bg-blue-500',
  DELETE: 'bg-red-600 hover:bg-red-500',
}

export default function ApiBlock({
  method, label, buildUrl, buildBody, inputs = [], noAuth = false, onToken,
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
      const url = buildUrl(vals.current)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (!noAuth) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
        if (token) headers['Authorization'] = `Bearer ${token}`
      }
      const options: RequestInit = { method, headers }
      if (buildBody && method !== 'GET') {
        options.body = JSON.stringify(buildBody(vals.current))
      }
      const res = await fetch(url, options)
      let body: unknown
      try { body = await res.json() } catch { body = await res.text() }
      if (onToken && typeof body === 'object' && body !== null && 'token' in body) {
        onToken((body as Record<string, string>).token)
      }
      setResponse({ status: res.status, body })
    } catch (e) {
      setResponse({ status: 0, body: { error: String(e) } })
    } finally {
      setLoading(false)
    }
  }

  function handleClick() {
    if (hasInputs && !open) { setOpen(true); return }
    run()
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#161b27] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold shrink-0 ${METHOD_BADGE[method]}`}>
            {method}
          </span>
          <span className="text-sm font-medium text-slate-200 truncate">{label}</span>
        </div>
        <button
          onClick={handleClick}
          disabled={loading}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white
            transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shrink-0
            ${BTN_COLOR[method]}`}
        >
          {loading ? (
            <>
              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Cargando
            </>
          ) : hasInputs && !open ? 'Configurar' : 'Ejecutar'}
        </button>
      </div>

      {/* Collapsible form */}
      {hasInputs && open && (
        <div className="px-4 pb-4 border-t border-white/[0.05] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {inputs.map(inp => (
            <div key={inp.key} className={inp.type === 'datetime-local' ? 'sm:col-span-1' : ''}>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                {inp.label}{inp.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {inp.options ? (
                <select
                  className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-sm
                    text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50
                    focus:border-blue-500/50 transition-all duration-150"
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
                  className="w-full px-3 py-2 bg-[#0f1117] border border-white/10 rounded-lg text-sm
                    text-slate-100 placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:ring-blue-500/50
                    focus:border-blue-500/50 transition-all duration-150"
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
                text-white transition-all duration-150 disabled:opacity-50 ${BTN_COLOR[method]}`}
            >
              {loading ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Ejecutando…</>
              ) : 'Ejecutar'}
            </button>
            <button
              onClick={() => { setOpen(false); setResponse(null) }}
              className="px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Response block */}
      {response && (
        <div className={`mx-4 mb-4 rounded-lg border text-xs font-mono leading-relaxed overflow-auto max-h-72 p-4
          ${ response.status >= 400 || response.status === 0
            ? 'bg-red-950/20 border-red-500/25 text-red-300'
            : 'bg-[#0a0d14] border-white/[0.06] text-slate-300'
          }`}>
          <div className={`mb-2 font-bold text-[11px] uppercase tracking-wide
            ${ response.status >= 400 || response.status === 0 ? 'text-red-400' : 'text-emerald-400' }`}>
            {response.status === 0 ? 'Error de red' : `HTTP ${response.status}`}
          </div>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(response.body, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
