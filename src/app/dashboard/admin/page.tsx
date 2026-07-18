'use client'
import { useState } from 'react'

const BASE = 'https://app-chny.onrender.com'

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
      const res = await fetch(`${BASE}/api/admin/repair-tenant-db`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      const data = await res.json()
      setResult({ status: res.status, data })
      if (res.ok) showToast('Base de datos activada correctamente', 'success')
      else showToast(`Error ${res.status}: ${(data as {message?:string}).message || 'Error desconocido'}`, 'error')
    } catch (e) {
      showToast('Error de conexión', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Administración del sistema</h1>
          <p className="page-subtitle">Acciones de mantenimiento — solo para administradores</p>
        </div>
      </div>

      <div className="max-w-xl space-y-4">
        {/* Warning banner */}
        <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-300">Zona de acciones críticas</p>
            <p className="text-xs text-amber-400/70 mt-0.5">Estas acciones afectan directamente la base de datos del tenant. Usar con precaución.</p>
          </div>
        </div>

        {/* Repair DB card */}
        <div className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Activar BD del negocio</h3>
              <p className="text-xs text-slate-500 mt-1">Ejecuta la reparación y activación de la base de datos del tenant.</p>
              <code className="text-xs text-slate-600 mt-2 block font-mono">POST /api/admin/repair-tenant-db</code>
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

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success'
            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M15 9l-6 6M9 9l6 6"/></svg>
          }
          {toast.msg}
        </div>
      )}
    </div>
  )
}
