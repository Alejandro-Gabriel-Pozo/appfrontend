'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  {
    section: 'Principal',
    items: [
      {
        href: '/dashboard',
        label: 'Resumen',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      },
    ],
  },
  {
    section: 'Recursos',
    items: [
      {
        href: '/dashboard/recursos',
        label: 'Recursos',
        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      },
    ],
  },
  {
    section: 'Operaciones',
    items: [
      {
        href: '/dashboard/reservas',
        label: 'Reservas',
        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      },
      {
        href: '/dashboard/reportes',
        label: 'Reportes',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      },
    ],
  },
  {
    section: 'Sistema',
    items: [
      {
        href: '/dashboard/admin',
        label: 'Admin',
        icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      },
    ],
  },
]

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="icon" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
      {d.split(' M').map((segment, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={i === 0 ? segment : 'M' + segment} />
      ))}
    </svg>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.replace('/login'); return }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      setUser(payload.email || payload.sub || 'Admin')
    } catch { setUser('Admin') }
  }, [router])

  function logout() {
    localStorage.removeItem('token')
    router.replace('/login')
  }

  const initials = user ? user[0].toUpperCase() : 'A'

  const Sidebar = () => (
    <aside
      className="flex flex-col h-full w-64"
      style={{
        backgroundColor: 'var(--surface-1)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {/* Logomark */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
          style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 12px var(--accent-dim)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>ReservaHub</p>
          <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Panel de control</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV.map(group => (
          <div key={group.section}>
            <p className="section-title">{group.section}</p>
            {group.items.map(item => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`sidebar-link${isActive ? ' active' : ''}`}
                >
                  <NavIcon d={item.icon} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 8px' }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{
              backgroundColor: 'var(--accent-dim)',
              border: '1px solid var(--accent-border)',
              color: '#c7d2fe',
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {user || 'Admin'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Administrador</p>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="btn-ghost p-1.5"
            style={{ borderRadius: '6px' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-col md:w-64 shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div
            className="absolute left-0 top-0 h-full w-64 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header
          className="md:hidden flex items-center gap-3 px-4 py-3"
          style={{
            backgroundColor: 'var(--surface-1)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn-ghost p-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>ReservaHub</span>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{ backgroundColor: 'var(--surface-0)' }}
        >
          <div className="p-6 max-w-screen-xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
