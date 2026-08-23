'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { resourcesApi, reservationsApi } from '@/lib/api'
import TelemetryCard from '@/components/TelemetryCard'
import SignalBadge from '@/components/SignalBadge'

type Reservation = { id?: string | number; status?: string; created_at?: string; resource_id?: string | number }
type Resource     = { id?: string | number; name?: string; active?: boolean }

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
    <Link href={href} className="quick-link">
      <div className="quick-link-icon">{icon}</div>
      <div>
        <p className="quick-link-label">{label}</p>
        <p className="quick-link-desc">{description}</p>
      </div>
    </Link>
  )
}

function RecentReservations({ reservations, loading }: { reservations: Reservation[]; loading: boolean }) {
  const recent = reservations.slice(0, 5)

  const statusState: Record<string, 'confirmed' | 'pending' | 'completed' | 'cancelled'> = {
    CONFIRMED: 'confirmed',
    PENDING:   'pending',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  }

  const statusLabel: Record<string, string> = {
    CONFIRMED: 'Confirmada',
    PENDING:   'Pendiente',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
  }

  return (
    <div
      className="card"
      style={{ overflow: 'hidden' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-tertiary)', letterSpacing: '0.09em' }}
        >
          Últimas reservas
        </h2>
        <Link
          href="/dashboard/reservas"
          className="text-xs font-medium"
          style={{ color: 'var(--accent)' }}
        >
          Ver todas →
        </Link>
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton h-4 w-8" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="empty-state py-10">
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3>Sin reservas</h3>
          <p>Las reservas aparecerán aquí</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Recurso</th>
                <th>Fecha</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={r.id ?? i}>
                  <td className="table-cell-mono">#{String(r.id ?? i + 1).slice(-4)}</td>
                  <td className="table-cell-primary">{r.resource_id ? `Recurso ${r.resource_id}` : '—'}</td>
                  <td style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                      : '—'}
                  </td>
                  <td>
                    <SignalBadge
                      state={statusState[r.status ?? ''] ?? 'pending'}
                      label={statusLabel[r.status ?? ''] ?? r.status ?? '—'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DashboardHome() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [resources, setResources]       = useState<Resource[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    Promise.all([
      reservationsApi.list().catch(() => []),
      resourcesApi.list().catch(() => []),
    ]).then(([res, rec]) => {
      setReservations(Array.isArray(res) ? res : [])
      setResources(Array.isArray(rec) ? rec : [])
    }).finally(() => setLoading(false))
  }, [])

  const confirmed = reservations.filter(r => r.status === 'CONFIRMED').length
  const pending   = reservations.filter(r => r.status === 'PENDING').length
  const activeRes = resources.filter(r => r.active !== false).length

  const today = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="zulu animate-fade-in" style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>

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
        <TelemetryCard
          loading={loading}
          label="Total Reservas"
          value={reservations.length}
          sub="Todas las reservas"
          variant="info"
          icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <TelemetryCard
          loading={loading}
          label="Confirmadas"
          value={confirmed}
          sub="Estado CONFIRMED"
          variant="success"
          icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <TelemetryCard
          loading={loading}
          label="Pendientes"
          value={pending}
          sub="Esperando confirmación"
          variant="warning"
          icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <TelemetryCard
          loading={loading}
          label="Recursos activos"
          value={activeRes}
          sub={`De ${resources.length} registrados`}
          variant="success"
          icon={
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
      </div>

      {/* Últimas reservas */}
      <div className="mt-8">
        <RecentReservations reservations={reservations} loading={loading} />
      </div>

      {/* Quick links */}
      <div className="mt-6">
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
