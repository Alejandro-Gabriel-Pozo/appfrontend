'use client'
import { useState, type ReactNode } from 'react'

interface Props {
  method: 'GET' | 'POST' | 'DELETE'
  title: string
  endpoint: string
  onSubmit: () => Promise<{ status: number; data: unknown }>
  formContent?: ReactNode
}

export default function ApiSection({ method, title, endpoint, onSubmit, formContent }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ status: number; data: unknown } | null>(null)

  const methodBadge = method === 'GET' ? 'badge-get' : method === 'POST' ? 'badge-post' : 'badge-del'
  const btnCls = method === 'GET' ? 'btn-secondary' : method === 'POST' ? 'btn-primary' : 'btn-danger'

  async function run() {
    setLoading(true)
    try {
      const r = await onSubmit()
      setResult(r)
      if (!open && !formContent) setOpen(true)
    } catch (e: unknown) {
      setResult({ status: 0, data: { error: e instanceof Error ? e.message : 'Error de red' } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
        onClick={() => formContent && setOpen(o => !o)}
      >
        <span className={methodBadge}>{method}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <code className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{endpoint}</code>
        </div>
        <div className="flex items-center gap-2">
          {!formContent && (
            <button onClick={e => { e.stopPropagation(); run() }} disabled={loading} className={btnCls}>
              {loading ? <><span className="spinner" />Cargando...</> : 'Ejecutar'}
            </button>
          )}
          {formContent && (
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              style={{ color: 'var(--text-tertiary)' }}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>

      {/* Collapsible form */}
      {formContent && open && (
        <div className="px-5 pb-5 border-t border-white/[0.05]">
          <div className="pt-4 space-y-3">
            {formContent}
            <div className="pt-2">
              <button onClick={run} disabled={loading} className={btnCls}>
                {loading ? <><span className="spinner" />Ejecutando...</> : 'Ejecutar'}
              </button>
            </div>
          </div>

          {result && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${result.status >= 400 ? 'bg-red-500/15 text-red-400' : result.status >= 200 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                  {result.status}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {result.status >= 200 && result.status < 300 ? 'Éxito' : result.status >= 400 ? 'Error' : 'Sin respuesta'}
                </span>
              </div>
              <pre className={`response-block${result.status >= 400 ? ' error' : ''}`}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Inline result (no form) */}
      {!formContent && result && (
        <div className="px-5 pb-5 border-t border-white/[0.05]">
          <div className="flex items-center gap-2 mt-4 mb-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${result.status >= 400 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
              {result.status}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{result.status >= 200 && result.status < 300 ? 'Éxito' : 'Error'}</span>
          </div>
          <pre className={`response-block${result.status >= 400 ? ' error' : ''}`}>
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
