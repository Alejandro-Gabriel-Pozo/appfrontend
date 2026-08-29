'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import ZuluBrand from '@/components/ZuluBrand'

// Vacío a propósito, mismo criterio que /login: /register se pide same-origin
// (rewrite nuevo en next.config.js, 19/08/2026 -- el backend lo monta sin
// prefijo /api, igual que /platform).
const BASE = ''

/**
 * Alta pública de negocio nuevo (19/08/2026, E7a — backend ya existía
 * desde antes, POST /register en app-main/src/platform/business.routes.ts,
 * sin pantalla hasta ahora: los negocios se daban de alta a mano en la
 * base). Un solo paso — nombre del negocio, email y contraseña del dueño —
 * el backend resuelve slug, rol OWNER y aprovisionamiento de la BD del
 * tenant (Neon) automáticamente.
 */
export default function RegistroPage() {
  const router = useRouter()
  const { refreshUser } = useAuth()

  const [businessName, setBusinessName] = useState('')
  const [ownerEmail, setOwnerEmail]     = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${BASE}/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, ownerEmail, ownerPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'No se pudo registrar el negocio')

      // El backend ya seteó la cookie httpOnly de sesión (setAuthCookie,
      // 19/08/2026) — solo falta que AuthContext se entere.
      await refreshUser()
      router.replace('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-8">
          <ZuluBrand subtitle="CENTRO OPERATIVO" />
          <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-secondary)' }}>Una operación coordinada empieza con contexto.</p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-md)', boxShadow: 'var(--shadow-lg)' }}>
          <h2 className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Crear negocio</h2>
          <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
            Vas a quedar como dueño (rol OWNER) de este negocio nuevo
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nombre del negocio</label>
              <input
                type="text" required minLength={2} maxLength={100} autoComplete="organization"
                value={businessName} onChange={e => setBusinessName(e.target.value)}
                placeholder="Ej. Hotel Los Álamos" className="input"
              />
            </div>
            <div>
              <label className="label">Tu email</label>
              <input
                type="email" required autoComplete="email"
                value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}
                placeholder="vos@tunegocio.com" className="input"
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password" required minLength={8} autoComplete="new-password"
                value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres" className="input"
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Si este email ya tiene cuenta en otro negocio, usá esa misma contraseña.
              </p>
            </div>

            {error && (
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
                style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-border)', color: 'var(--danger)' }}
              >
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-1" style={{ height: '38px' }}>
              {loading ? <><span className="spinner" /> Creando negocio…</> : 'Crear negocio'}
            </button>
          </form>

          <p className="text-center text-xs mt-5" style={{ color: 'var(--text-tertiary)' }}>
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" style={{ color: 'var(--zulu-link)' }}>Iniciá sesión</Link>
          </p>
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: 'var(--text-tertiary)' }}>
          ZULU &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
