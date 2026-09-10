'use client'
import { useState, useEffect, useCallback } from 'react'
import { platformApi, type PlatformRolePreset } from '@/lib/platformApi'
import { extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'

// Mismo motivo que superadmin/planes/page.tsx: 8 grupos fijos en código
// (app-main/src/security/roles.ts), sin endpoint que los liste dinámicamente.
const PERMISSION_GROUPS = [
  'OWNER_ONLY', 'MANAGEMENT', 'STAFF', 'FRONT_DESK',
  'HOUSEKEEPING_AND_MANAGEMENT', 'ORDERS', 'CUSTOMER_ONLY', 'BOOKING',
]

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

export default function SuperadminRolePresetsPage() {
  const { toast } = useToast()
  const [presets, setPresets] = useState<PlatformRolePreset[]>([])
  const [loading, setLoading] = useState(true)
  const [savingName, setSavingName] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setPresets(await platformApi.rolePresets.list())
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  function updateLocal(name: string, permissionGroups: string[]) {
    setPresets(prev => prev.map(p => p.name === name ? { ...p, permissionGroups } : p))
  }

  async function handleSave(p: PlatformRolePreset) {
    setSavingName(p.name)
    try {
      const updated = await platformApi.rolePresets.update(p.name, p.permissionGroups)
      setPresets(prev => prev.map(x => x.name === p.name ? updated : x))
      // PRESET-REVOKE-001 Parte 2 (10/09/2026) -- el radio real del click,
      // no solo "se guardó": cuántas filas de role_permission_groups
      // cambiaron en negocios existentes.
      const { propagatedGranted: granted, propagatedRevoked: revoked } = updated
      const detail = granted === 0 && revoked === 0
        ? 'sin cambios en negocios existentes'
        : `${granted} alta(s), ${revoked} baja(s) en negocios existentes`
      toast(`Preset ${p.name} actualizado -- ${detail}`, 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setSavingName(null)
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">Roles de fábrica</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Catálogo global de los 5 roles que recibe un negocio al crearse.
          </p>
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mt-3"
            style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-border)', color: 'var(--danger)' }}
          >
            <span>
              <strong>Tildar o destildar acá cambia TODOS los negocios que ya existen, al
              instante.</strong> Guardar este preset propaga en las dos direcciones dentro
              del mismo click — agregar un grupo lo suma a todos los roles de fábrica con
              ese nombre; sacarlo se lo saca a todos, incluidas personalizaciones que un
              negocio hubiera hecho antes de que esto se bloqueara. No hay reinicio de
              servidor de por medio ni asimetría entre agregar y sacar.
              <br />
              <strong>Los negocios ya no pueden customizar sus propios roles de fábrica</strong> —
              este catálogo es la única forma de cambiar qué puede hacer OWNER, ADMIN,
              RECEPTIONIST, HOUSEKEEPING o WAITER.
              <br />
              <strong>Cuidado con vaciar OWNER sin MANAGEMENT</strong> — deja a todos los
              negocios sin acceso a sus propias pantallas de roles y usuarios, al instante.
              Recuperación: ver &quot;Recuperar un preset de roles vaciado por error&quot; en el
              runbook de deploy.
            </span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-lg bg-white/[0.04] animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {presets.map(p => (
              <div key={p.name} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-white">{p.name}</h2>
                  <button
                    onClick={() => handleSave(p)}
                    disabled={savingName === p.name}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {savingName === p.name ? <span className="spinner" /> : 'Guardar'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {PERMISSION_GROUPS.map(group => (
                    <label key={group} className="flex items-center gap-1.5 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={p.permissionGroups.includes(group)}
                        onChange={() => updateLocal(p.name, toggle(p.permissionGroups, group))}
                      />
                      {group}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
