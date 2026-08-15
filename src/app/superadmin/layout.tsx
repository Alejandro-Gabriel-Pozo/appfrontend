'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { ToastProvider } from '@/context/ToastContext'
import { PlatformAuthProvider, usePlatformAuth } from '@/context/PlatformAuthContext'

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

  return <>{children}</>
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
