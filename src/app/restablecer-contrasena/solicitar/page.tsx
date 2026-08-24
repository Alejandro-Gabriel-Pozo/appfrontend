'use client'
import { useState } from 'react'
import Link from 'next/link'
import { passwordResetAcceptanceApi, extractErrorMessage } from '@/lib/api'

/**
 * L (23/08/2026, pendientes-2026-08-23.md) — pedir el link de reseteo
 * self-service, sin admin de por medio. Página PÚBLICA, mismo patrón
 * visual que /restablecer-contrasena/confirmar y /login.
 *
 * El backend responde el mismo mensaje genérico exista o no esa cuenta
 * (anti-enumeración, A7.2) — la UI muestra "listo" siempre que la llamada
 * no falle por red, nunca distingue "no existe" de "sí existe". No
 * necesita useSearchParams (a diferencia de /confirmar), no hace falta
 * envolverla en Suspense.
 */
export default function RequestPasswordResetPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    try {
      await passwordResetAcceptanceApi.request(email)
      setDone(true)
    } catch (err) {
      // Solo errores de red/validación de formato llegan acá -- el backend
      // nunca responde "esa cuenta no existe" (ver docblock arriba).
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
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>ReservaHub</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Recuperar contraseña</p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-md)', boxShadow: 'var(--shadow-lg)' }}>
          {done ? (
            <>
              <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Revisá tu email</h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
                Si <strong>{email}</strong> tiene una cuenta, te vamos a mandar un link para restablecer la contraseña.
              </p>
              <Link href="/login" className="btn-secondary w-full" style={{ height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Volver a iniciar sesión
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                ¿Olvidaste tu contraseña?
              </h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
                Ingresá tu email y te mandamos un link para restablecerla.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  Mandar link
                </button>
              </form>

              <p className="text-center text-xs mt-5" style={{ color: 'var(--text-tertiary)' }}>
                <Link href="/login" style={{ color: 'var(--accent)' }}>← Volver a iniciar sesión</Link>
              </p>
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
