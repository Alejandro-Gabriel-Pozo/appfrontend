'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { platformApi } from '@/lib/platformApi'
import { extractErrorMessage } from '@/lib/api'
import { usePlatformAuth } from '@/context/PlatformAuthContext'

export default function SuperadminLoginPage() {
  const router = useRouter()
  const { setSession } = usePlatformAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await platformApi.login(email, password)
      setSession({ ...result, email })
      router.replace('/superadmin')
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl mb-4"
            style={{ backgroundColor: 'var(--accent-dark)', boxShadow: '0 0 0 1px var(--accent-border), var(--shadow-md)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
            ReservaHub — Plataforma
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Acceso exclusivo SUPERADMIN
          </p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-md)', boxShadow: 'var(--shadow-lg)' }}>
          <h2 className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Iniciar sesión</h2>
          <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
            No confundir con el login del panel de un negocio
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="superadmin@tudominio.com" className="input"
              />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" className="input"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs" style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-border)', color: 'var(--danger)' }}>
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-1" style={{ height: '38px' }}>
              {loading ? <><span className="spinner" /> Ingresando…</> : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: 'var(--text-tertiary)' }}>
          ReservaHub &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
