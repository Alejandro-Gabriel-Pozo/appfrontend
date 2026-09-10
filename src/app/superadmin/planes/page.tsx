'use client'
import { useState, useEffect, useCallback } from 'react'
import { platformApi, type PlatformPlanLimits } from '@/lib/platformApi'
import { extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'

// L (23/08/2026) — 9 grupos fijos en código (app-main/src/security/roles.ts).
// Agregar un grupo nuevo siempre es un cambio de backend, así que esta
// lista se mantiene a mano en sync con esa fuente — no hay endpoint que la
// devuelva dinámicamente hoy. EMISOR_NOTA_CREDITO sumado el 09/09/2026
// (gate architecture-governor) -- agregado al backend el 07/09/2026,
// nunca propagado acá. `plan_limit_allowed_permission_groups` se lee vivo
// en cada request (assertPermissionGroupsAllowedInPlan), no se copia a
// tenants -- a diferencia de los presets de roles-de-fabrica/page.tsx,
// que SÍ propagan por backfill (ver ese archivo, sin tocar en este bloque).
const PERMISSION_GROUPS = [
  'OWNER_ONLY', 'MANAGEMENT', 'STAFF', 'FRONT_DESK',
  'HOUSEKEEPING_AND_MANAGEMENT', 'ORDERS', 'EMISOR_NOTA_CREDITO', 'CUSTOMER_ONLY', 'BOOKING',
]

// Roles asignables vía POST/PUT /api/users — OWNER queda afuera a
// propósito, nunca se asigna desde esa API (ver comentario real en
// usuarios-roles/users.routes.ts).
const ASSIGNABLE_ROLE_NAMES = ['ADMIN', 'RECEPTIONIST', 'HOUSEKEEPING', 'WAITER']

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

export default function SuperadminPlanesPage() {
  const { toast } = useToast()
  const [plans, setPlans] = useState<PlatformPlanLimits[]>([])
  const [loading, setLoading] = useState(true)
  const [savingPlan, setSavingPlan] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPlans(await platformApi.planLimits.list())
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  function updateLocal(plan: string, patch: Partial<PlatformPlanLimits>) {
    setPlans(prev => prev.map(p => p.plan === plan ? { ...p, ...patch } : p))
  }

  async function handleSave(p: PlatformPlanLimits) {
    setSavingPlan(p.plan)
    try {
      const updated = await platformApi.planLimits.update(p.plan, {
        maxCategories: p.maxCategories,
        maxResources: p.maxResources,
        maxActiveMemberships: p.maxActiveMemberships,
        maxCustomRoles: p.maxCustomRoles,
        allowedRoleNames: p.allowedRoleNames,
        allowedPermissionGroups: p.allowedPermissionGroups,
      })
      setPlans(prev => prev.map(x => x.plan === p.plan ? updated : x))
      toast(`Plan ${p.plan} actualizado`, 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSavingPlan(null)
    }
  }

  function NumberField({ plan, field, label }: { plan: PlatformPlanLimits; field: keyof PlatformPlanLimits; label: string }) {
    const value = plan[field] as number | null
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</span>
        <input
          type="number"
          min={0}
          value={value ?? ''}
          placeholder="Sin límite"
          onChange={e => updateLocal(plan.plan, { [field]: e.target.value === '' ? null : Number(e.target.value) } as Partial<PlatformPlanLimits>)}
          className="input text-sm py-1.5 w-28"
        />
      </label>
    )
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Planes</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Límites de uso y qué grupos de permisos habilita cada plan. Vacío = sin límite.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-lg bg-white/[0.04] animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map(p => (
              <div key={p.plan} className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-white">{p.plan}</h2>
                  <button
                    onClick={() => handleSave(p)}
                    disabled={savingPlan === p.plan}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {savingPlan === p.plan ? <span className="spinner" /> : 'Guardar'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-4 mb-5">
                  <NumberField plan={p} field="maxCategories" label="Categorías" />
                  <NumberField plan={p} field="maxResources" label="Recursos" />
                  <NumberField plan={p} field="maxActiveMemberships" label="Usuarios activos" />
                  <NumberField plan={p} field="maxCustomRoles" label="Roles personalizados" />
                </div>

                <div className="mb-4">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">
                    Roles de fábrica asignables (vacío = sin restricción, todos)
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {ASSIGNABLE_ROLE_NAMES.map(name => (
                      <label key={name} className="flex items-center gap-1.5 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={p.allowedRoleNames.includes(name)}
                          onChange={() => updateLocal(p.plan, { allowedRoleNames: toggle(p.allowedRoleNames, name) })}
                        />
                        {name}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">
                    Grupos de permiso disponibles para roles personalizados (vacío = sin restricción, todos)
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {PERMISSION_GROUPS.map(group => (
                      <label key={group} className="flex items-center gap-1.5 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={p.allowedPermissionGroups.includes(group)}
                          onChange={() => updateLocal(p.plan, { allowedPermissionGroups: toggle(p.allowedPermissionGroups, group) })}
                        />
                        {group}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
