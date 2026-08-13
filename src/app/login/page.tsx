'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

// Vacío a propósito: /api/* se pide same-origin, ver next.config.js (B2).
const BASE = ''

interface BusinessOption {
  businessId: string
  businessName: string
  role: string
}

export default function LoginPage() {
  const router = useRouter()
  const { setToken } = useAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Paso 2 del login: solo aparece si el mismo email tiene cuenta en más
  // de un negocio (identity compartida, ver src/security/auth.service.ts
  // en el backend). Para el caso común (1 solo negocio) esto nunca se usa.
  const [pendingSelection, setPendingSelection] = useState<{
    identityToken: string
    businesses: BusinessOption[]
  } | null>(null)

  function applyLoginResult(data: { token?: string }) {
    const token = data.token
    if (!token) throw new Error('No se recibió token en la respuesta')
    setToken(token)
    router.replace('/dashboard')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`${BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Credenciales inválidas')

      if (data.needsBusinessSelection) {
        setPendingSelection({ identityToken: data.identityToken, businesses: data.businesses })
        return
      }

      applyLoginResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectBusiness(businessId: string) {
    if (!pendingSelection) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`${BASE}/api/login/select-business`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityToken: pendingSelection.identityToken, businessId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'No se pudo completar el ingreso')
      applyLoginResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setPendingSelection(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="w-full max-w-[360px]">

        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl mb-4"
            style={{
              backgroundColor: 'var(--accent-dark)',
              boxShadow: '0 0 0 1px var(--accent-border), var(--shadow-md)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8"  y1="2" x2="8"  y2="6" />
              <line x1="3"  y1="10" x2="21" y2="10" />
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
            </svg>
          </div>
          <h1
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.025em' }}
          >
            ReservaHub
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Panel de administración
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: 'var(--surface-2)',
            border: '1px solid var(--border-md)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {pendingSelection ? (
            <>
              <h2
                className="text-sm font-semibold mb-0.5"
                style={{ color: 'var(--text-primary)' }}
              >
                Elegí tu negocio
              </h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
                Tu cuenta tiene acceso a más de un negocio
              </p>

              <div className="space-y-2">
                {pendingSelection.businesses.map((b) => (
                  <button
                    key={b.businessId}
                    type="button"
                    disabled={loading}
                    onClick={() => handleSelectBusiness(b.businessId)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm"
                    style={{
                      border: '1px solid var(--border-md)',
                      background: 'var(--surface-1)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <div className="font-medium">{b.businessName}</div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{b.role}</div>
                  </button>
                ))}
              </div>

              {error && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mt-4"
                  style={{
                    background: 'var(--danger-dim)',
                    border: '1px solid var(--danger-border)',
                    color: 'var(--danger)',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => { setPendingSelection(null); setError('') }}
                className="text-xs mt-4"
                style={{ color: 'var(--text-tertiary)' }}
              >
                ← Volver
              </button>
            </>
          ) : (
            <>
              <h2
                className="text-sm font-semibold mb-0.5"
                style={{ color: 'var(--text-primary)' }}
              >
                Iniciar sesión
              </h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
                Ingresá con tu cuenta de administrador
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@empresa.com"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Contraseña</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input"
                  />
                </div>

                {error && (
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
                    style={{
                      background: 'var(--danger-dim)',
                      border: '1px solid var(--danger-border)',
                      color: 'var(--danger)',
                    }}
                  >
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none"
                      stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="15" y1="9" x2="9" y2="15"/>
                      <line x1="9"  y1="9" x2="15" y2="15"/>
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full mt-1"
                  style={{ height: '38px' }}
                >
                  {loading
                    ? <><span className="spinner" /> Ingresando…</>
                    : 'Ingresar'
                  }
                </button>
              </form>
            </>
          )}
        </div>

        <p
          className="text-center text-[11px] mt-6"
          style={{ color: 'var(--text-tertiary)' }}
        >
          ReservaHub &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
