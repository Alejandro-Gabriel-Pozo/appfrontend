'use client'
import { useState, useEffect, useCallback } from 'react'
import { platformApi, type PlatformBusiness, type PlatformStats } from '@/lib/platformApi'
import { extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import { usePlatformAuth } from '@/context/PlatformAuthContext'

const STATUS_LABEL: Record<PlatformBusiness['status'], string> = {
  PENDING: 'Pendiente', ACTIVE: 'Activo', SUSPENDED: 'Suspendido', CANCELLED: 'Cancelado',
}
const STATUS_CLASS: Record<PlatformBusiness['status'], string> = {
  PENDING:   'bg-amber-500/10 text-amber-400',
  ACTIVE:    'bg-emerald-500/10 text-emerald-400',
  SUSPENDED: 'bg-slate-500/10 text-slate-400',
  CANCELLED: 'bg-red-500/10 text-red-400',
}
// A qué estados puede pasar un negocio desde el que está — mismas reglas
// que valida platform.routes.ts (CANCELLED no vuelve, no hay transición a
// sí mismo). PENDING nunca es un destino válido (UpdateBusinessStatusSchema
// no lo acepta) — se sale de PENDING solo aprovisionando, no por acá.
const NEXT_STATUSES: Record<PlatformBusiness['status'], PlatformBusiness['status'][]> = {
  PENDING:   ['SUSPENDED', 'CANCELLED'],
  ACTIVE:    ['SUSPENDED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
}

// L (23/08/2026) — a diferencia del estado, el plan no tiene transiciones
// restringidas: cualquier plan a cualquier plan (mismo criterio que ya
// valida platform.routes.ts).
const ALL_PLANS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE']

export default function SuperadminBusinessesPage() {
  const { toast } = useToast()
  const { session, clearSession } = usePlatformAuth()

  const [businesses, setBusinesses] = useState<PlatformBusiness[]>([])
  const [stats, setStats]           = useState<PlatformStats | null>(null)
  const [loading, setLoading]       = useState(true)
  const [busyId, setBusyId]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [businessesRes, statsRes] = await Promise.all([platformApi.businesses.list(), platformApi.stats()])
      setBusinesses(businessesRes.businesses)
      setStats(statsRes)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  async function handleProvision(b: PlatformBusiness) {
    setBusyId(b.id)
    try {
      await platformApi.businesses.provision(b.id)
      toast(`${b.name}: base de datos aprovisionada`, 'success')
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function handleStatusChange(b: PlatformBusiness, status: PlatformBusiness['status']) {
    setBusyId(b.id)
    try {
      await platformApi.businesses.updateStatus(b.id, status as 'ACTIVE' | 'SUSPENDED' | 'CANCELLED')
      toast(`${b.name} → ${STATUS_LABEL[status]}`, 'success')
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePlanChange(b: PlatformBusiness, plan: string) {
    setBusyId(b.id)
    try {
      await platformApi.businesses.updatePlan(b.id, plan)
      toast(`${b.name} → plan ${plan}`, 'success')
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Negocios</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {session?.email ? `Conectado como ${session.email}` : 'Panel de plataforma'}
            </p>
          </div>
          <button onClick={clearSession} className="btn-secondary text-sm">Cerrar sesión</button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {([['total', 'Total'], ['active', 'Activos'], ['pending', 'Pendientes'], ['suspended', 'Suspendidos']] as const).map(([key, label]) => (
              <div key={key} className="card px-4 py-3">
                <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
                <div className="text-2xl font-semibold text-white mt-1">{stats[key]}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-white/[0.04] animate-pulse" />)}
          </div>
        ) : businesses.length === 0 ? (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <p className="text-slate-400 font-medium">Todavía no hay negocios registrados</p>
          </div>
        ) : (
          <div className="card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Negocio</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">BD</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {businesses.map(b => (
                  <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-white">{b.name}</div>
                      <div className="text-xs text-slate-500">/{b.slug} · {b.ownerEmail}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">{b.plan}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[b.status]}`}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${b.hasTenantDb ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {b.hasTenantDb ? 'Aprovisionada' : 'Sin aprovisionar'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {!b.hasTenantDb && (
                          <button
                            onClick={() => handleProvision(b)}
                            disabled={busyId === b.id}
                            className="btn-secondary text-xs px-2.5 py-1.5"
                          >
                            {busyId === b.id ? <span className="spinner" /> : 'Provisionar'}
                          </button>
                        )}
                        {NEXT_STATUSES[b.status].length > 0 && (
                          <select
                            disabled={busyId === b.id}
                            value=""
                            onChange={e => e.target.value && handleStatusChange(b, e.target.value as PlatformBusiness['status'])}
                            className="input text-xs py-1.5 w-auto"
                          >
                            <option value="" disabled>Cambiar estado…</option>
                            {NEXT_STATUSES[b.status].map(s => (
                              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                        )}
                        {/* L (23/08/2026) — antes el único camino era un UPDATE a mano en la BD central. */}
                        <select
                          disabled={busyId === b.id}
                          value=""
                          onChange={e => e.target.value && handlePlanChange(b, e.target.value)}
                          className="input text-xs py-1.5 w-auto"
                        >
                          <option value="" disabled>Cambiar plan…</option>
                          {ALL_PLANS.filter(p => p !== b.plan).map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
