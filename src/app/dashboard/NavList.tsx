'use client'
import Link from 'next/link'
import { useBusinessContext } from '@/lib/business-context/provider'

/**
 * Navegación del sidebar del dashboard — V3-a.
 *
 * El catálogo `NAV` (href, label, icono, moduleKey, managementOnly) es LOCAL
 * al frontend (decisión D-A): el backend no emite navegación. El gating por
 * módulo pasó de `useBusinessModules()` a `BusinessContext.enabledModules`.
 *
 * FAIL-OPEN, sin cambios respecto de antes: mientras el contexto carga o si
 * falló, `useBusinessContext()` devuelve `null` y se muestran TODOS los
 * ítems. El gate real es el backend (402 `MODULE_NOT_ENABLED`).
 *
 * `moduleKey` ausente  -> el ítem siempre se muestra.
 * `managementOnly`     -> depende de `isManagement` (rol), no del contexto.
 */

interface NavItem {
  href: string
  label: string
  icon: string
  moduleKey?: string
  managementOnly?: boolean
}

const NAV: NavItem[] = [
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

export default function NavList({
  pathname,
  isManagement,
}: {
  pathname: string
  isManagement: boolean
}) {
  const ctx = useBusinessContext()

  const visibleNav = NAV.filter(
    item =>
      // fail-open: sin contexto (loading | error) -> se muestra todo, como
      // antes con `modules === null`.
      (!item.moduleKey || !ctx || (ctx.enabledModules as string[]).includes(item.moduleKey)) &&
      (!item.managementOnly || isManagement),
  )

  return (
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
  )
}
