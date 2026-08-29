'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ToastProvider } from '@/context/ToastContext'
import { PlatformAuthProvider, usePlatformAuth } from '@/context/PlatformAuthContext'

// L (23/08/2026) — antes /superadmin era una sola pantalla ("Negocios"),
// sin nav. Ahora hay 3: Negocios, Planes, Roles de fábrica. Mismo estilo
// Tailwind slate que ya usa page.tsx (el panel de superadmin no usa el
// sistema de diseño .zulu del dashboard).
const NAV_LINKS = [
  { href: '/superadmin', label: 'Negocios' },
  { href: '/superadmin/planes', label: 'Planes' },
  { href: '/superadmin/roles-de-fabrica', label: 'Roles de fábrica' },
]

function SuperadminNav() {
  const pathname = usePathname() ?? ''
  return (
    <nav className="flex items-center gap-1 px-6 pt-4" style={{ borderBottom: '1px solid var(--zulu-overlay-06)' }}>
      {NAV_LINKS.map(link => (
        <Link
          key={link.href}
          href={link.href}
          className="px-3 py-2 text-sm rounded-t-lg"
          style={{
            color: pathname === link.href ? 'white' : '#94a3b8',
            background: pathname === link.href ? 'var(--zulu-overlay-04)' : 'transparent',
          }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

// Gate real, dentro de la misma jerarquía que envuelve el Provider — no se
// puede usar usePlatformAuth() en este mismo componente porque el Provider
// todavía no montó en ese punto del árbol.
function Gate({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname() ?? ''
  const { isAuthenticated, isLoading } = usePlatformAuth()

  // /superadmin/login vive DENTRO de esta misma carpeta (comparte layout),
  // a diferencia de /login (staff) que es un route hermano de /dashboard —
  // sin este chequeo, sin sesión, el gate redirige a /superadmin/login,
  // que a su vez está gateado por este mismo layout: loop.
  const isLoginRoute = pathname === '/superadmin/login'

  useEffect(() => {
    if (isLoading || isLoginRoute) return
    if (!isAuthenticated) router.push('/superadmin/login')
  }, [isLoading, isAuthenticated, isLoginRoute, router])

  if (isLoginRoute) return <>{children}</>

  if (isLoading || !isAuthenticated) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg)' }}>
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--bg)' }}>
      <SuperadminNav />
      {children}
    </div>
  )
}

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformAuthProvider>
      <ToastProvider>
        <Gate>{children}</Gate>
      </ToastProvider>
    </PlatformAuthProvider>
  )
}
