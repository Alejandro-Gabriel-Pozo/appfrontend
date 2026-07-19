'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ToastProvider } from '@/context/ToastContext'

const NAV = [
  { href: '/dashboard', label: 'Inicio', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/dashboard/recursos', label: 'Recursos', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { href: '/dashboard/categorias', label: 'Categorías', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
  { href: '/dashboard/reservas', label: 'Reservas', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/dashboard/clientes', label: 'Clientes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/dashboard/reportes', label: 'Reportes', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/dashboard/admin', label: 'Admin', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<{ name: string; role: string } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUser({ name: payload.email ?? payload.sub ?? 'Usuario', role: payload.role ?? '' })
    } catch {}
  }, [])

  function logout() {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-[#0f1117] text-slate-200 overflow-hidden">
        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-[#1a1d27] border-r border-white/[0.06]
          flex flex-col transition-transform duration-200
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
            <svg className="w-7 h-7 text-emerald-400 mr-2.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6.75v6.75" />
            </svg>
            <span className="font-semibold text-white tracking-tight">ReservaApp</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            <ul className="space-y-0.5">
              {NAV.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                      }`}
                    >
                      <svg className="w-4.5 h-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* User */}
          {user && (
            <div className="p-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
                  {user.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{user.role.toLowerCase()}</p>
                </div>
              </div>
              <button onClick={logout} className="w-full text-left text-xs text-slate-500 hover:text-red-400 transition-colors">
                Cerrar sesión
              </button>
            </div>
          )}
        </aside>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar */}
          <header className="h-16 flex items-center px-4 lg:px-6 border-b border-white/[0.06] bg-[#0f1117] shrink-0">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors mr-3"
              aria-label="Menú"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
