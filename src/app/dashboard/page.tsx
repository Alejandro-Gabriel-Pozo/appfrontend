'use client'
import { useState, useEffect } from 'react'

const BASE = 'https://app-chny.onrender.com'

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-slate-500 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardHome() {
  const [reservations, setReservations] = useState<unknown[]>([])
  const [resources, setResources] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token') || ''
    const h = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${BASE}/api/reservations`, { headers: h }).then(r => r.json()).catch(() => []),
      fetch(`${BASE}/api/resources`, { headers: h }).then(r => r.json()).catch(() => []),
    ]).then(([res, rec]) => {
      setReservations(Array.isArray(res) ? res : res.data || [])
      setResources(Array.isArray(rec) ? rec : rec.data || [])
    }).finally(() => setLoading(false))
  }, [])

  const confirmed = (reservations as {status?: string}[]).filter(r => r.status === 'CONFIRMED').length
  const pending = (reservations as {status?: string}[]).filter(r => r.status === 'PENDING').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Resumen general</h1>
          <p className="page-subtitle">Vista rápida del estado del sistema</p>
        </div>
        <span className="text-xs text-slate-600 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-3 bg-white/5 rounded w-24 mb-3" />
              <div className="h-7 bg-white/5 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Reservas" value={reservations.length} sub="Todas las reservas" color="text-white" />
          <StatCard label="Confirmadas" value={confirmed} sub="Estado CONFIRMED" color="text-emerald-400" />
          <StatCard label="Pendientes" value={pending} sub="Esperando confirmación" color="text-amber-400" />
          <StatCard label="Recursos" value={resources.length} sub="Registrados en el sistema" color="text-indigo-400" />
        </div>
      )}

      <div className="mt-8 card p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Ver Recursos', href: '/dashboard/recursos', color: 'bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border-indigo-500/20' },
            { label: 'Nueva Reserva', href: '/dashboard/reservas?action=new', color: 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-500/20' },
            { label: 'Reportes', href: '/dashboard/reportes', color: 'bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border-violet-500/20' },
            { label: 'Admin BD', href: '/dashboard/admin', color: 'bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 border-orange-500/20' },
          ].map(q => (
            <a key={q.href} href={q.href} className={`flex items-center justify-center py-3 px-4 rounded-xl border text-sm font-medium transition-all duration-150 ${q.color}`}>
              {q.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
