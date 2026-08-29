'use client'
import { useState } from 'react'
import { apiFetch } from '@/lib/api'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Sin módulo propio — acento brass por defecto (sección 6 del doc). El
// banner de advertencia usa los tokens --warning* (brass) en vez de amber
// hardcodeado — mismo semáforo "pendiente/atención" que ya usan los badges.

export default function AdminPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{status:number;data:unknown}|null>(null)
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'}|null>(null)

  function showToast(msg: string, type: 'success'|'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function repairDB() {
    setLoading(true)
    setResult(null)
    try {
      const data = await apiFetch<unknown>('/api/admin/repair-tenant-db', { method: 'POST' })
      setResult({ status: 200, data })
      showToast('Base de datos activada correctamente', 'success')
    } catch (e: unknown) {
      const err = e as { httpStatus?: number; message?: string }
      const status = err.httpStatus ?? 500
      setResult({ status, data: e })
      showToast(
        status >= 400
          ? `Error ${status}: ${err.message ?? 'Error desconocido'}`
          : 'Error de conexión',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Administración del sistema</h1>
          <p className="page-subtitle">Acciones de mantenimiento — solo para administradores</p>
        </div>
      </div>

      <div className="max-w-xl space-y-4">
        {/* Warning banner */}
        <div className="flex gap-3 p-4 rounded-xl" style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning-border)' }}>
          <svg className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>Zona de acciones críticas</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--warning)', opacity: 0.8 }}>Estas acciones afectan directamente la base de datos del tenant. Usar con precaución.</p>
          </div>
        </div>

        {/* Repair DB card */}
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Activar BD del negocio</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Ejecuta la reparación y activación de la base de datos del tenant.</p>
              <code className="text-xs mt-2 block font-mono" style={{ color: 'var(--text-tertiary)' }}>POST /api/admin/repair-tenant-db</code>
            </div>
            <span className="badge-post">POST</span>
          </div>

          <button onClick={repairDB} disabled={loading} className="btn-primary">
            {loading
              ? <><span className="spinner" /> Ejecutando...</>
              : <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Activar base de datos
              </>
            }
          </button>

          {result && (
            <pre className={`response-block${result.status >= 400 ? ' error' : ''}`}>
              <span className={`text-xs font-bold mr-2 ${result.status >= 400 ? 'text-red-400' : 'text-emerald-400'}`}>
                {result.status}
              </span>
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* V2.6.2a: `.toast` ya no se posiciona solo — el contenedor es `.toast-stack`. */}
      {toast && (
        <div className="toast-stack" aria-live="polite">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success'
              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6"/></svg>
            }
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  )
}
