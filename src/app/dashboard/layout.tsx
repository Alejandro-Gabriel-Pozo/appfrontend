'use client'
import { useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { Refine } from '@refinedev/core'
import routerProvider from '@refinedev/nextjs-router/app'
import { ToastProvider, useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useIsManagement } from '@/hooks/useAuthRole'
import { useBusinessModules } from '@/hooks/useBusinessModules'
import { systemApi, type DeadLetterEvent } from '@/lib/api'
import { dataProvider } from '@/lib/refine/dataProvider'
import { createAuthProvider } from '@/lib/refine/authProvider'
import SystemRail from '@/components/SystemRail'
import ZuluBrand from '@/components/ZuluBrand'

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
    href: '/dashboard/turnos',
    label: 'Turnos',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm4-6l2 2 4-4',
  },
  {
    href: '/dashboard/estadias',
    label: 'Estadías',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    moduleKey: 'ALOJAMIENTO',
  },
  {
    href: '/dashboard/housekeeping',
    label: 'Housekeeping',
    icon: 'M4 4h16v4H4V4zm0 6h16v10H4V10zm4 3h8',
    moduleKey: 'HOUSEKEEPING',
  },
  {
    href: '/dashboard/ordenes',
    label: 'Órdenes',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    moduleKey: 'POS_RESTAURANTE',
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
    moduleKey: 'CUENTAS_CORRIENTES',
  },
  {
    href: '/dashboard/productos',
    label: 'Productos',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    moduleKey: 'POS_RESTAURANTE',
  },
  {
    href: '/dashboard/motivos-merma',
    label: 'Motivos de Merma',
    icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    moduleKey: 'POS_RESTAURANTE',
  },
  {
    href: '/dashboard/destinos-consumo',
    label: 'Destinos de Consumo',
    icon: 'M12 4.5v15m7.5-7.5h-15',
    moduleKey: 'POS_RESTAURANTE',
  },
  {
    href: '/dashboard/reportes',
    label: 'Reportes',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    moduleKey: 'REPORTES',
  },
  {
    href: '/dashboard/usuarios',
    label: 'Usuarios',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    // F2 (23/08/2026, pendientes-2026-08-23.md) -- reportado por el dueño:
    // RECEPTIONIST veía este ítem en el nav (y podía navegar a la pantalla
    // completa, con nombre/email/rol de todo el personal) aunque el
    // backend rechaza sus mutaciones (authorize(Roles.MANAGEMENT)). Ver
    // dashboard/usuarios/page.tsx para el mismo gate aplicado a la
    // pantalla, por si alguien entra directo por URL.
    managementOnly: true,
  },
  {
    href: '/dashboard/roles',
    label: 'Roles',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    // L (23/08/2026) -- mismo criterio que Usuarios: el backend ya rechaza
    // POST/PUT/DELETE /api/roles para roles sin MANAGEMENT, esto solo evita
    // un link a una pantalla donde igual no podrían hacer nada.
    managementOnly: true,
  },
  {
    href: '/dashboard/mi-negocio',
    label: 'Mi Negocio',
    icon: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01',
  },
  {
    href: '/dashboard/empresa',
    label: 'Empresa',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m4-14h2m-2 4h2m-2 4h2m4-8h2m-2 4h2m-2 4h2',
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
  '/dashboard/admin':       'Admin',
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
        border: '1px solid rgba(239,68,68,0.35)',
        background: 'rgba(239,68,68,0.08)',
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
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#fca5a5', fontWeight: 600 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {events.length === 1
            ? '1 evento no se pudo procesar automáticamente'
            : `${events.length} eventos no se pudieron procesar automáticamente`}
        </span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{expanded ? 'Ocultar' : 'Ver detalle'}</span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(239,68,68,0.25)', padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11.5, color: '#9ca3af', margin: '4px 0 2px' }}>
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
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, color: '#e2e4ea', fontWeight: 500 }}>{ev.eventType}</p>
                <p style={{ fontSize: 11, color: '#6b7280' }}>
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
                  color: '#fff',
                  background: retryingId === ev.id ? '#7f1d1d' : '#dc2626',
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
  const modules = useBusinessModules()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) router.push('/login')
  }, [isLoading, isAuthenticated, router])

  const visibleNav = NAV.filter(
    item =>
      (!item.moduleKey || modules === null || modules[item.moduleKey] !== false) &&
      (!item.managementOnly || isManagement),
  )

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
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060a1f' }}>
        <span style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #00e0ff', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <ToastProvider>
      <Refine
        dataProvider={dataProvider}
        authProvider={refineAuthProvider}
        routerProvider={routerProvider}
        resources={REFINE_RESOURCES}
        options={{ syncWithLocation: false, disableTelemetry: true }}
      >
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
            background: 'var(--surface-1)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1)',
            transform: sidebarOpen ? 'translateX(0)' : undefined,
            flexShrink: 0,
          }}
          className={`sidebar-desktop${sidebarOpen ? ' sidebar-open' : ''}`}
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
          <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
            <p className="mono" style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px 8px' }}>
              Navegación
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {visibleNav.map(item => {
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
                        color: active ? 'var(--zulu-module-context)' : 'var(--text-secondary)',
                        background: active ? 'var(--zulu-surface-selected)' : 'transparent',
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
                            background: 'var(--zulu-module-context)',
                            boxShadow: '0 0 8px var(--zulu-module-context)',
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
                    background: 'rgba(255,255,255,0.03)',
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
          a:hover { color: var(--text-primary) !important; background: rgba(255,255,255,0.05) !important; }
        `}</style>
      </div>
      </Refine>
    </ToastProvider>
  )
}
