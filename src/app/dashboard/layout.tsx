'use client'
import { useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { Refine } from '@refinedev/core'
import routerProvider from '@refinedev/nextjs-router/app'
import { ToastProvider, useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useIsManagement } from '@/hooks/useAuthRole'
import { BusinessContextProvider } from '@/lib/business-context/provider'
import { endpointSource } from '@/lib/business-context/sources'
import { systemApi, type DeadLetterEvent } from '@/lib/api'
import { dataProvider } from '@/lib/refine/dataProvider'
import { createAuthProvider } from '@/lib/refine/authProvider'
import SystemRail from '@/components/SystemRail'
import ZuluBrand from '@/components/ZuluBrand'
import NavList from './NavList'

// ─── Sistema de diseño "ZULU" (docs/*, migración 23/08/2026 — reemplaza a
// Bastión) ──────────────────────────────────────────────────────────────
// Las 3 tipografías se cargan UNA vez acá (mismo criterio que ya regía para
// Bastión, auditoria-modularidad.md Fase 2/F8) — cascadean como variables
// CSS (--font-zulu-display/sans/mono) a cualquier pantalla que use `.zulu`
// sin que esa pantalla tenga que declararlas de nuevo.
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-zulu-display' })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-zulu-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-zulu-mono' })

// Piloto del data provider (18/08/2026) — solo estos dos recursos tienen
// adaptador en src/lib/refine/dataProvider.ts por ahora. Sumar acá cuando
// se migre la pantalla correspondiente, no antes (evita un menú de Refine
// que promete recursos sin pantalla migrada todavía).
const REFINE_RESOURCES = [
  { name: 'categorias', list: '/dashboard/categorias' },
  { name: 'productos', list: '/dashboard/productos' },
  { name: 'recursos', list: '/dashboard/recursos' },
  { name: 'servicios', list: '/dashboard/servicios' },
  { name: 'usuarios', list: '/dashboard/usuarios' },
  { name: 'clientes', list: '/dashboard/clientes' },
  { name: 'reservas', list: '/dashboard/reservas' },
  { name: 'estadias', list: '/dashboard/estadias' },
  { name: 'housekeeping', list: '/dashboard/housekeeping' },
  { name: 'ordenes', list: '/dashboard/ordenes' },
  { name: 'motivos-merma', list: '/dashboard/motivos-merma' },
  { name: 'destinos-consumo', list: '/dashboard/destinos-consumo' },
  { name: 'roles', list: '/dashboard/roles' },
]


const PAGE_TITLES: Record<string, string> = {
  '/dashboard':             'Resumen',
  '/dashboard/recursos':    'Recursos',
  '/dashboard/categorias':  'Categorías',
  '/dashboard/servicios':   'Servicios',
  '/dashboard/reservas':    'Reservas',
  '/dashboard/turnos':      'Turnos',
  '/dashboard/estadias':    'Estadías',
  '/dashboard/housekeeping':'Housekeeping',
  '/dashboard/ordenes':     'Órdenes',
  '/dashboard/clientes':    'Clientes',
  '/dashboard/cuentas-corrientes': 'Cuentas Corrientes',
  '/dashboard/productos':   'Productos',
  '/dashboard/motivos-merma': 'Motivos de Merma',
  '/dashboard/destinos-consumo': 'Destinos de Consumo',
  '/dashboard/reportes':    'Reportes',
  '/dashboard/usuarios':    'Usuarios',
  '/dashboard/roles':       'Roles',
  '/dashboard/mi-negocio':  'Mi Negocio',
  '/dashboard/empresa':     'Empresa',
}

// A9.5/A8.7 (15/08/2026): antes un evento fallido se reintentaba para
// siempre en silencio, sin ninguna señal para un humano más allá de un log
// que nadie lee. Este aviso es esa señal — visible en cualquier página del
// panel para OWNER/ADMIN mientras haya eventos en dead-letter.
function OutboxAlertBanner() {
  const { toast } = useToast()
  const [events, setEvents] = useState<DeadLetterEvent[] | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [retryingId, setRetryingId] = useState<number | null>(null)

  function reload() {
    systemApi.getDeadLetter()
      .then(({ events }) => setEvents(events))
      .catch(() => setEvents(null))
  }

  useEffect(() => { reload() }, [])

  async function handleRetry(id: number) {
    setRetryingId(id)
    try {
      await systemApi.retry(id)
      toast('Evento reencolado — se procesa en los próximos segundos.', 'success')
      reload()
    } catch {
      toast('No se pudo reintentar el evento. Probá de nuevo.', 'error')
    } finally {
      setRetryingId(null)
    }
  }

  if (!events || events.length === 0) return null

  return (
    <div
      style={{
        marginBottom: 16,
        borderRadius: 10,
        border: '1px solid var(--zulu-danger-border)',
        background: 'var(--zulu-danger-dim)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--zulu-legacy-alert-title)', fontWeight: 600 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {events.length === 1
            ? '1 evento no se pudo procesar automáticamente'
            : `${events.length} eventos no se pudieron procesar automáticamente`}
        </span>
        <span style={{ fontSize: 11, color: 'var(--zulu-legacy-alert-meta)' }}>{expanded ? 'Ocultar' : 'Ver detalle'}</span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--zulu-danger-border)', padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11.5, color: 'var(--zulu-legacy-alert-meta)', margin: '4px 0 2px' }}>
            Cada uno se reintentó varias veces solo, sin éxito. Reintentar de nuevo puede resolverlo si ya se corrigió lo que lo bloqueaba.
          </p>
          {events.map(ev => (
            <div
              key={ev.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'var(--zulu-overlay-03)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, color: 'var(--zulu-legacy-alert-text)', fontWeight: 500 }}>{ev.eventType}</p>
                <p style={{ fontSize: 11, color: 'var(--zulu-legacy-alert-meta-dim)' }}>
                  {new Date(ev.failedAt).toLocaleString('es-AR')} · {ev.retryCount} intentos
                  {ev.lastError ? ` · ${ev.lastError}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleRetry(ev.id)}
                disabled={retryingId === ev.id}
                style={{
                  flexShrink: 0,
                  padding: '5px 12px',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: 'var(--zulu-on-context)',
                  background: retryingId === ev.id ? 'var(--zulu-legacy-alert-btn-busy)' : 'var(--zulu-legacy-alert-btn)',
                  border: 'none',
                  cursor: retryingId === ev.id ? 'default' : 'pointer',
                }}
              >
                {retryingId === ev.id ? 'Reintentando…' : 'Reintentar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router      = useRouter()
  const rawPathname = usePathname()
  const pathname    = rawPathname ?? ''
  const { user, isAuthenticated, isLoading, logout: authLogout } = useAuth()
  const isManagement = useIsManagement()

  // Wrapper sobre AuthContext (ver lib/refine/authProvider.ts) — se
  // reconstruye solo cuando cambia el estado de sesión real, no en cada
  // render, para no reiniciar el estado interno de auth de Refine de más.
  const refineAuthProvider = useMemo(
    () => createAuthProvider({ isAuthenticated, user, logout: authLogout }),
    [isAuthenticated, user, authLogout],
  )

  const [sidebarOpen, setSidebarOpen] = useState(false)
  // V3-a: fuente del BusinessContext. `endpointSource()` devuelve una
  // función nueva cada llamada y el provider resetea a `loading` cuando
  // cambia -> hay que memoizarla UNA vez, o cada render reinicia el fetch.
  const ctxSource = useMemo(() => endpointSource(), [])

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) router.push('/login')
  }, [isLoading, isAuthenticated, router])

  useEffect(() => { queueMicrotask(() => setSidebarOpen(false)) }, [pathname])

  async function logout() {
    await authLogout()
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
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-0)' }}>
        <span style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--zulu-brand)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const dashboardTree = (
      <div
        className={`zulu ${spaceGrotesk.variable} ${plexSans.variable} ${plexMono.variable}`}
        style={{
          display: 'flex',
          height: '100dvh',
          background: 'var(--bg)',
          color: 'var(--text-primary)',
          overflow: 'hidden',
        }}
      >
        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <aside
          style={{
            position: sidebarOpen ? 'fixed' : undefined,
            inset: sidebarOpen ? '0 auto 0 0' : undefined,
            zIndex: 40,
            width: 240,
            background: 'var(--zulu-surface-shell)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)',
            transform: sidebarOpen ? 'translateX(0)' : undefined,
            flexShrink: 0,
          }}
          className={`zulu-shell-dark sidebar-desktop${sidebarOpen ? ' sidebar-open' : ''}`}
        >
          {/* Lockup de marca */}
          <div
            style={{
              height: 74,
              display: 'flex',
              alignItems: 'center',
              padding: '0 20px',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <ZuluBrand subtitle="CENTRO OPERATIVO" compact />
          </div>

          {/* Nav */}
          <NavList pathname={pathname} isManagement={isManagement} />

          {/* Usuario */}
          <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
            {user ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--zulu-overlay-03)',
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: 'var(--zulu-surface-selected)',
                      border: '1px solid var(--zulu-module-context-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--zulu-module-context)',
                      fontSize: 12,
                      fontFamily: 'var(--font-zulu-mono)',
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {user.email[0]?.toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </p>
                    <p className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'capitalize' }}>
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
                    color: 'var(--text-secondary)',
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
              <div style={{ height: 56, background: 'var(--zulu-overlay-04)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
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
              background: 'var(--zulu-scrim)',
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
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
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
                  color: 'var(--text-secondary)',
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
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>ZULU / OPERACIÓN</span>
                {pathname !== '/dashboard' && (
                  <>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--border-lg)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{currentTitle}</span>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SystemRail isManagement={isManagement} />
            </div>
          </header>

          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 24px',
            }}
          >
            {isAuthenticated && isManagement && <OutboxAlertBanner />}
            {isAuthenticated ? children : null}
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
          a:hover { color: var(--text-primary) !important; background: var(--zulu-overlay-05) !important; }
        `}</style>
      </div>
  )

  return (
    <ToastProvider>
      <Refine
        dataProvider={dataProvider}
        authProvider={refineAuthProvider}
        routerProvider={routerProvider}
        resources={REFINE_RESOURCES}
        options={{ syncWithLocation: false, disableTelemetry: true }}
      >
        {isAuthenticated
          ? <BusinessContextProvider source={ctxSource}>{dashboardTree}</BusinessContextProvider>
          : dashboardTree}
      </Refine>
    </ToastProvider>
  )
}
