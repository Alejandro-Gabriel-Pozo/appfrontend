'use client'
import { useEffect } from 'react'
import { useRouter, useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/context/CustomerAuthContext'

export default function CuentaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const params = useParams()
  const slug = params?.businessSlug as string
  const { customer, isLoading, logout: doLogout } = useCustomerAuth()

  useEffect(() => {
    if (isLoading) return
    if (!customer) router.push(`/portal/${slug}/login`)
  }, [isLoading, customer, slug, router])

  function logout() {
    void doLogout()
    router.push(`/portal/${slug}/login`)
  }

  if (isLoading || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="spinner" style={{ width: 24, height: 24 }} />
      </div>
    )
  }

  const navItems = [
    { href: `/portal/${slug}/cuenta/reservas`, label: 'Mis reservas' },
    { href: `/portal/${slug}/cuenta/perfil`,    label: 'Mi cuenta' },
  ]

  return (
    <div>
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <nav className="flex items-center gap-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="sidebar-link"
              style={pathname.startsWith(item.href) ? { color: 'var(--accent)' } : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{customer.fullName}</span>
          <button onClick={logout} className="btn-ghost">Salir</button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
