'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://app-chny.onrender.com'

type Reservation = { status?: string; created_at?: string }
type Resource     = { active?: boolean }

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  loading,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  accent: string
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="kpi-card">
        <div className="skeleton h-3 w-20 mb-4" />
        <div className="skeleton h-8 w-14 mb-3" />
        <div className="skeleton h-3 w-28" />
      </div>
    )
  }
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between mb-3">
        <span className="kpi-label">{label}</span>
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ backgroundColor: accent + '18', color: accent }}
        >
          {icon}
        </div>
      </div>
      <p className="kpi-value">{value}</p>
      <p className="kpi-trend">{sub}</p>
    </div>
  )
}

function QuickLink({
  href,
  label,
  icon,
  description,
}: {
  href: string
  label: string
  icon: React.ReactNode
  description: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 p-4 rounded-xl transition-all duration-150"
      style={{
        backgroundColor: 'var(--surface-2)',
        border: '1px solid var(--border)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--border-md)'
        el.style.backgroundColor = 'var(--surface-3)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.borderColor = 'var(--border)'
        el.style.backgroundColor = 'var(--surface-2)'
      }}
    >
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg"
        style={{ backgroundColor: 'rgba(45,212,191,0.10)', color: 'var(--accent)' }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
      </div>
    </Link>
  )
}

export default function DashboardHome() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [resources, setResources]       = useState<Resource[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token') || ''
    const h = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`${BASE}/api/reservations`, { headers: h }).then(r => r.json()).catch(() => []),
      fetch(`${BASE}/api/resources`,    { headers: h }).then(r => r.json()).catch(() => []),
    ]).then(([res, rec]) => {
      setReservations(Array.isArray(res) ? res : (res.data ?? []))
      setResources(Array.isArray(rec)    ? rec : (rec.data ?? []))
    }).finally(() => setLoading(false))
  }, [])

  const confirmed  = reservations.filter(r => r.status === 'CONFIRMED').length
  const pending    = reservations.filter(r => r.status === 'PENDING').length
  const activeRes  = resources.filter(r => r.active !== false).length

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Resumen general</h1>
          <p className="page-subtitle">Vista rápida del estado del sistema</p>
        </div>
        <span
          className="text-xs px-3 py-1.5 rounded-full shrink-0 capitalize"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          {today}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          loading={loading}
          label="Total Reservas"
          value={reservations.length}
          sub="Todas las reservas"
          accent="#60a5fa"
          icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <KpiCard
          loading={loading}
          label="Confirmadas"
          value={confirmed}
          sub="Estado CONFIRMED"
          accent="#34d399"
          icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KpiCard
          loading={loading}
          label="Pendientes"
          value={pending}
          sub="Esperando confirmación"
          accent="#fbbf24"
          icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KpiCard
          loading={loading}
          label="Recursos activos"
          value={activeRes}
          sub={`De ${resources.length} registrados`}
          accent="#2dd4bf"
          icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
      </div>

      {/* Quick links */}
      <div className="mt-8">
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--text-tertiary)', letterSpacing: '0.09em' }}
        >
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink
            href="/dashboard/recursos"
            label="Recursos"
            description="Ver y gestionar recursos"
            icon={
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
          <QuickLink
            href="/dashboard/reservas"
            label="Reservas"
            description="Listar y crear reservas"
            icon={
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <QuickLink
            href="/dashboard/reportes"
            label="Reportes"
            description="Estadísticas y ocupación"
            icon={
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />
          <QuickLink
            href="/dashboard/admin"
            label="Admin BD"
            description="Gestión de base de datos"
            icon={
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  )
}
