'use client'
import { useState } from 'react'

type Method = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH'

interface ApiBlockProps {
  method: Method
  label: string
  buildUrl: (inputs: Record<string, string>) => string
  buildBody?: (inputs: Record<string, string>) => unknown
  inputs?: Array<{
    key: string
    label: string
    type?: string
    options?: string[]
    placeholder?: string
    required?: boolean
  }>
  noAuth?: boolean
  onToken?: (token: string) => void
}

const METHOD_COLORS: Record<Method, string> = {
  GET: 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/50',
  POST: 'bg-blue-900/60 text-blue-400 border border-blue-700/50',
  DELETE: 'bg-red-900/60 text-red-400 border border-red-700/50',
  PUT: 'bg-amber-900/60 text-amber-400 border border-amber-700/50',
  PATCH: 'bg-purple-900/60 text-purple-400 border border-purple-700/50',
}

const BTN_COLORS: Record<Method, string> = {
  GET: 'bg-emerald-700 hover:bg-emerald-600',
  POST: 'bg-blue-700 hover:bg-blue-600',
  DELETE: 'bg-red-700 hover:bg-red-600',
  PUT: 'bg-amber-700 hover:bg-amber-600',
  PATCH: 'bg-purple-700 hover:bg-purple-600',
}

export default function ApiBlock({ method, label, buildUrl, buildBody, inputs, noAuth, onToken }: ApiBlockProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{ status: number; data: unknown } | null>(null)
  const [inputValues, setInputValues] = useState<Record<string, string>>({})
  const hasInputs = inputs && inputs.length > 0

  async function handleCall() {
    setLoading(true)
    setResponse(null)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (!noAuth && token) headers['Authorization'] = `Bearer ${token}`

      const url = buildUrl(inputValues)
      const body = buildBody ? buildBody(inputValues) : undefined
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
      const contentType = res.headers.get('content-type') || ''
      let data: unknown
      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        data = await res.text()
      }
      setResponse({ status: res.status, data })
      if (onToken && res.ok && typeof data === 'object' && data !== null) {
        const d = data as Record<string, unknown>
        const t = d.token || d.access_token || d.accessToken
        if (typeof t === 'string') onToken(t)
      }
    } catch (err) {
      setResponse({ status: 0, data: { error: String(err) } })
    } finally {
      setLoading(false)
    }
  }

  function handleClick() {
    if (hasInputs && !open) {
      setOpen(true)
      return
    }
    handleCall()
  }

  const isError = response && response.status >= 400

  return (
    <div className="bg-[#1a1f2e] border border-[#2d3748] rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${METHOD_COLORS[method]}`}>
          {method}
        </span>
        <span className="text-sm text-slate-200 flex-1 font-medium">{label}</span>
        {hasInputs && (
          <button
            onClick={() => setOpen(o => !o)}
            className="text-slate-500 hover:text-slate-300 transition"
            aria-label="Toggle form"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        )}
        <button
          onClick={handleClick}
          disabled={loading}
          className={`${BTN_COLORS[method]} disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 min-w-[80px] justify-center`}
        >
          {loading ? (
            <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          )}
          {loading ? 'Cargando' : 'Ejecutar'}
        </button>
      </div>

      {hasInputs && open && (
        <div className="px-4 pb-4 pt-1 border-t border-[#2d3748] space-y-3">
          {inputs!.map(input => (
            <div key={input.key}>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {input.label}
                {input.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {input.options ? (
                <select
                  value={inputValues[input.key] || ''}
                  onChange={e => setInputValues(v => ({ ...v, [input.key]: e.target.value }))}
                  className="w-full bg-[#0f1117] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
                >
                  <option value="">— seleccionar —</option>
                  {input.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={input.type || 'text'}
                  value={inputValues[input.key] || ''}
                  onChange={e => setInputValues(v => ({ ...v, [input.key]: e.target.value }))}
                  placeholder={input.placeholder}
                  className="w-full bg-[#0f1117] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {response && (
        <div className={`border-t ${isError ? 'border-red-800/50' : 'border-[#2d3748]'}`}>
          <div className={`flex items-center gap-2 px-4 py-2 ${isError ? 'bg-red-950/40' : 'bg-[#111827]'}`}>
            <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${isError ? 'bg-red-900/60 text-red-400' : 'bg-emerald-900/60 text-emerald-400'}`}>
              {response.status === 0 ? 'ERR' : response.status}
            </span>
            <span className="text-xs text-slate-500">Respuesta</span>
          </div>
          <pre className={`px-4 py-3 text-xs overflow-auto max-h-72 font-mono ${isError ? 'text-red-300 bg-red-950/20' : 'text-slate-300 bg-[#0d1117]'}`}>
            {JSON.stringify(response.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
