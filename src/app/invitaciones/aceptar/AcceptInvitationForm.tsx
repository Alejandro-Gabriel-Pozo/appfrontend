'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { invitationAcceptanceApi, extractErrorMessage } from '@/lib/api'
import type { InvitationPreview } from '@/lib/types'

/**
 * D2, pendientes-2026-08-19.md — acepta una invitación de usuario. Página
 * PÚBLICA (fuera de /dashboard, sin AuthContext) — quien la abre todavía no
 * tiene sesión. El token viaja en la query string del LINK del mail (así
 * llega hasta acá), pero las llamadas a la API lo mandan por BODY, nunca
 * por URL/query de esta API — ver docblock del backend,
 * `user-invitation.routes.ts`.
 *
 * Envuelto en `<Suspense>` por el page.tsx del directorio (requisito de
 * `useSearchParams` en Client Components, Next.js 16).
 */
export default function AcceptInvitationForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') ?? null

  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      if (!token) {
        setLoadError('Este link no tiene un token de invitación válido.')
        setLoading(false)
        return
      }
      invitationAcceptanceApi.lookup(token)
        .then(setPreview)
        .catch(err => setLoadError(extractErrorMessage(err)))
        .finally(() => setLoading(false))
    })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (preview?.requiresPassword && password !== passwordConfirm) {
      setSubmitError('Las contraseñas no coinciden')
      return
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      await invitationAcceptanceApi.accept({
        token,
        ...(preview?.requiresPassword && { password }),
      })
      setDone(true)
    } catch (err) {
      setSubmitError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
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
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>ReservaHub</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Invitación</p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-md)', boxShadow: 'var(--shadow-lg)' }}>
          {loading ? (
            <div className="flex justify-center py-4"><span className="spinner" /></div>
          ) : loadError ? (
            <>
              <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Invitación inválida</h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{loadError}</p>
              <p className="text-xs mt-4">
                <Link href="/login" style={{ color: 'var(--accent)' }}>Ir al inicio de sesión</Link>
              </p>
            </>
          ) : done ? (
            <>
              <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>¡Listo!</h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
                Ya sos parte de <strong>{preview?.businessName}</strong>. Iniciá sesión con {preview?.email}
                {preview?.requiresPassword ? ' y la contraseña que acabás de elegir.' : ' y tu contraseña habitual.'}
              </p>
              <button onClick={() => router.replace('/login')} className="btn-primary w-full" style={{ height: '38px' }}>
                Ir a iniciar sesión
              </button>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                Te invitaron a {preview?.businessName}
              </h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
                Vas a sumarte como <strong>{preview?.roleName}</strong> con el email {preview?.email}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {preview?.requiresPassword && (
                  <>
                    <div>
                      <label className="label">Elegí tu contraseña</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Confirmá la contraseña</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={passwordConfirm}
                        onChange={e => setPasswordConfirm(e.target.value)}
                        placeholder="••••••••"
                        className="input"
                      />
                    </div>
                  </>
                )}

                {submitError && (
                  <div
                    className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
                    style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-border)', color: 'var(--danger)' }}
                  >
                    {submitError}
                  </div>
                )}

                <button type="submit" disabled={submitting} className="btn-primary w-full mt-1" style={{ height: '38px' }}>
                  {submitting ? <span className="spinner" /> : null}
                  {preview?.requiresPassword ? 'Crear cuenta y unirme' : 'Aceptar invitación'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: 'var(--text-tertiary)' }}>
          ReservaHub &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
