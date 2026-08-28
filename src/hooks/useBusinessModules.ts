'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { businessModulesApi } from '@/lib/api'

/**
 * Módulos habilitados del negocio (extraído de dashboard/layout.tsx,
 * D8 29/08/2026 — segunda pantalla que necesita el mismo gating, ver
 * appfrontend-main/CLAUDE.md sobre no duplicar lógica entre pantallas).
 * `null` mientras carga (o si falla el fetch) — con null no se oculta
 * nada, el gate real ya lo hace el backend (402 MODULE_NOT_ENABLED).
 */
export function useBusinessModules(): Record<string, boolean> | null {
  const { isAuthenticated } = useAuth()
  const [modules, setModules] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    businessModulesApi.get()
      .then(({ modules }) => setModules(modules))
      .catch(() => setModules(null))
  }, [isAuthenticated])

  return modules
}
