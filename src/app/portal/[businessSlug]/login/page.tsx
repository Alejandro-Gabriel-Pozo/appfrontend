'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { customerAuthApi, extractErrorMessage } from '@/lib/customerApi'
import { readPendingBooking } from '@/lib/pendingBooking'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'

export default function CustomerLoginPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.businessSlug as string
  const { refreshCustomer } = useCustomerAuth()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  function goToAccount() {
    const pending = readPendingBooking()
    router.replace(pending ? `/portal/${slug}/cuenta/reservas?prefill=1` : `/portal/${slug}/cuenta/reservas`)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await customerAuthApi.login(slug, { email, password })
      await refreshCustomer(slug)
      goToAccount()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleCredential(idToken: string) {
    setLoading(true)
    setError('')
    try {
      await customerAuthApi.loginWithGoogle(slug, idToken)
      await refreshCustomer(slug)
      goToAccount()
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[360px]">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
            Iniciar sesión
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Portal de clientes
          </p>
        </div>

        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-md)', boxShadow: 'var(--shadow-lg)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vos@email.com"
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
              <div className="alert alert-danger">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-1" style={{ height: '38px' }}>
              {loading ? <><span className="spinner" /> Ingresando…</> : 'Ingresar'}
            </button>
          </form>

          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <div className="mt-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px" style={{ background: 'var(--border-md)' }} />
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>o</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-md)' }} />
              </div>
              <GoogleSignInButton onCredential={handleGoogleCredential} />
            </div>
          )}

          <p className="text-center text-xs mt-5" style={{ color: 'var(--text-tertiary)' }}>
            ¿No tenés cuenta?{' '}
            <Link href={`/portal/${slug}/register`} style={{ color: 'var(--accent)' }}>
              Registrate
            </Link>
          </p>
        </div>

        <p className="text-center text-xs mt-5">
          <Link href={`/portal/${slug}/disponibilidad`} style={{ color: 'var(--text-tertiary)' }}>
            ← Ver disponibilidad sin iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
