'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ToastProvider } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'

const NAV = [
  {
    href: '/dashboard',
    label: 'Inicio',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    href: '/dashboard/recursos',
    label: 'Recursos',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  },
  {
    href: '/dashboard/categorias',
    label: 'Categorías',
    icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
  },
  {
    href: '/dashboard/servicios',
    label: 'Servicios',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    href: '/dashboard/reservas',
    label: 'Reservas',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
  {
    href: '/dashboard/estadias',
    label: 'Estadías',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    href: '/dashboard/housekeeping',
    label: 'Housekeeping',
    icon: 'M4 4h16v4H4V4zm0 6h16v10H4V10zm4 3h8',
  },
  {
    href: '/dashboard/ordenes',
    label: 'Órdenes',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  },
  {
    href: '/dashboard/clientes',
    label: 'Clientes',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    href: '/dashboard/cuentas-corrientes',
    label: 'Cuentas Corrientes',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z',
  },
  {
    href: '/dashboard/productos',
    label: 'Productos',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  },
  {
    href: '/dashboard/reportes',
    label: 'Reportes',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    href: '/dashboard/usuarios',
    label: 'Usuarios',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    href: '/dashboard/mi-negocio',
    label: 'Mi Negocio',
    icon: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01',
  },
  {
    href: '/dashboard/admin',
    label: 'Admin',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':             'Resumen',
  '/dashboard/recursos':    'Recursos',
  '/dashboard/categorias':  'Categorías',
  '/dashboard/servicios':   'Servicios',
  '/dashboard/reservas':    'Reservas',
  '/dashboard/estadias':    'Estadías',
  '/dashboard/housekeeping':'Housekeeping',
  '/dashboard/ordenes':     'Órdenes',
  '/dashboard/clientes':    'Clientes',
  '/dashboard/cuentas-corrientes': 'Cuentas Corrientes',
  '/dashboard/productos':   'Productos',
  '/dashboard/reportes':    'Reportes',
  '/dashboard/usuarios':    'Usuarios',
  '/dashboard/mi-negocio':  'Mi Negocio',
  '/dashboard/admin':       'Admin',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router      = useRouter()
  const rawPathname = usePathname()
  const pathname    = rawPathname ?? ''
  const { user, token, isLoading, clearToken } = useAuth()

  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!token) router.push('/login')
  }, [isLoading, token, router])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  function logout() {
    clearToken()
    router.push('/login')
  }

  const currentTitle = (() => {
    if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
    const match = Object.keys(PAGE_TITLES)
      .filter(k => k !== '/dashboard')
      .find(k => pathname.startsWith(k))
    return match ? PAGE_TITLES[match] : 'Dashboard'
  })()

  if (isLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0e14' }}>
        <span style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #10b981', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <ToastProvider>
      <div
        style={{
          display: 'flex',
          height: '100dvh',
          background: '#0c0e14',
          color: '#e2e4ea',
          overflow: 'hidden',
          fontFamily: "'Inter', 'system-ui', sans-serif",
        }}
      >
        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <aside
          style={{
            position: sidebarOpen ? 'fixed' : undefined,
            inset: sidebarOpen ? '0 auto 0 0' : undefined,
            zIndex: 40,
            width: 240,
            background: '#13151e',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)',
            transform: sidebarOpen ? 'translateX(0)' : undefined,
            flexShrink: 0,
          }}
          className={`sidebar-desktop${sidebarOpen ? ' sidebar-open' : ''}`}
        >
          {/* Logo */}
          <div
            style={{
              height: 60,
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              gap: 10,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" fill="none" stroke="white" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>ReservaApp</p>
              <p style={{ fontSize: 10, color: '#4b5563', lineHeight: 1.2 }}>Panel de gestión</p>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px 8px' }}>
              Navegación
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {NAV.map(item => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        fontSize: 13.5,
                        fontWeight: active ? 600 : 400,
                        color: active ? '#10b981' : '#9ca3af',
                        background: active ? 'rgba(16,185,129,0.1)' : 'transparent',
                        textDecoration: 'none',
                        transition: 'all 150ms ease',
                        position: 'relative',
                      }}
                    >
                      {active && (
                        <span
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: '20%',
                            bottom: '20%',
                            width: 3,
                            borderRadius: '0 4px 4px 0',
                            background: '#10b981',
                          }}
                        />
                      )}
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={active ? 2.2 : 1.8}
                        viewBox="0 0 24 24"
                        style={{ flexShrink: 0 }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Usuario */}
          <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            {user ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#10b981,#047857)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {user.email[0]?.toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#e2e4ea', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </p>
                    <p style={{ fontSize: 10, color: '#4b5563', textTransform: 'capitalize' }}>
                      {user.role.toLowerCase() || 'usuario'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#6b7280',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'color 150ms',
                  }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <div style={{ height: 56, background: 'rgba(255,255,255,0.04)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
            )}
          </div>
        </aside>

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 30,
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(2px)',
            }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── MAIN ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* Top bar */}
          <header
            style={{
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: '#0c0e14',
              flexShrink: 0,
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setSidebarOpen(o => !o)}
                className="sidebar-toggle"
                aria-label="Abrir menú"
                style={{
                  display: 'none',
                  padding: '6px',
                  borderRadius: 8,
                  color: '#9ca3af',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#4b5563' }}>Dashboard</span>
                {pathname !== '/dashboard' && (
                  <>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: '#374151' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span style={{ fontSize: 12, color: '#e2e4ea', fontWeight: 500 }}>{currentTitle}</span>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>En línea</span>
              </div>
            </div>
          </header>

          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 24px',
            }}
          >
            {token ? children : null}
          </main>
        </div>

        <style>{`
          @media (max-width: 1023px) {
            .sidebar-desktop {
              position: fixed !important;
              transform: translateX(-100%) !important;
            }
            .sidebar-desktop.sidebar-open {
              transform: translateX(0) !important;
            }
            .sidebar-toggle {
              display: flex !important;
            }
          }
          @media (min-width: 1024px) {
            .sidebar-desktop {
              position: relative !important;
              transform: none !important;
            }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          a:hover { color: #e2e4ea !important; background: rgba(255,255,255,0.05) !important; }
        `}</style>
      </div>
    </ToastProvider>
  )
}
