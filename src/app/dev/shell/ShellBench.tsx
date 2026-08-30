'use client'
import { useMemo, useState } from 'react'
import { BusinessContextProvider, useBusinessContextState, useModuloVisible } from '@/lib/business-context/provider'
import { errorSource, mockSource, negocioComercio, negocioHosteleria, negocioSinClasificar } from '@/lib/business-context/sources'
import type { BusinessContext, ContextColor, ModuleKey } from '@/lib/business-context/types'

/**
 * Banco del shell — V3, capa visual.
 *
 * Construye el shell contra el contrato REAL de `BusinessContext`, con una
 * fuente mockeada. La condición que puso el dueño al aprobar V3: el mock
 * tiene la forma exacta del contrato, y ninguna pantalla lo importa — todo
 * pasa por el provider, así que conectar la Fase 4 es cambiar la fuente.
 *
 * Sirve además para ver los tres estados, que hoy no se pueden ver en la
 * app: `loading` y `error` se confundían en un solo `null`.
 */

const ESCENARIOS = {
  'Hotelería (brass)':    mockSource(negocioHosteleria),
  'Gastronomía (clay)':   mockSource(negocioComercio),
  'Sin clasificar':       mockSource(negocioSinClasificar),
  'Cargando (2s)':        mockSource(negocioHosteleria, 2000),
  'Falla el contexto':    errorSource(),
} as const

/** El color de contexto es un enum cerrado; acá se resuelve a token. */
const TOKEN_DE_COLOR: Record<ContextColor, string> = {
  BRASS:   'var(--zulu-brass)',
  CLAY:    'var(--zulu-clay)',
  SAGE:    'var(--zulu-sage)',
  NEUTRAL: 'var(--zulu-gray)',
}

/**
 * Catálogo de navegación — LOCAL al frontend (decisión D-A, 30/08/2026). El
 * backend no emite labels ni rutas: manda `enabledModules`, `terminology` y
 * `moduleColors`, y el shell arma con eso. Espejo reducido del array `NAV`
 * de `src/app/dashboard/layout.tsx`.
 */
interface ItemCatalogo {
  moduleKey: ModuleKey | null   // null = ítem transversal, sin gate de módulo
  href: string
  label: string                 // fallback si no hay término
  termKey?: string              // clave de terminología para el label
}

const CATALOGO_NAV: ItemCatalogo[] = [
  { moduleKey: null,              href: '/dashboard',             label: 'Resumen' },
  { moduleKey: 'ALOJAMIENTO',     href: '/dashboard/reservas',    label: 'Reservas',  termKey: 'reservation.plural' },
  { moduleKey: 'ALOJAMIENTO',     href: '/dashboard/recursos',    label: 'Recursos',  termKey: 'resource.plural' },
  { moduleKey: 'HOUSEKEEPING',    href: '/dashboard/housekeeping', label: 'Housekeeping' },
  { moduleKey: 'POS_RESTAURANTE', href: '/dashboard/ordenes',     label: 'Órdenes' },
  { moduleKey: 'FACTURACION',     href: '/dashboard/empresa',     label: 'Facturación' },
  { moduleKey: 'REPORTES',        href: '/dashboard/reportes',    label: 'Reportes' },
]

interface ItemRender {
  moduleKey: ModuleKey | null
  href: string
  label: string
  contextColor: ContextColor
}

/**
 * `catálogo local × terminology × moduleColors`. El filtro por módulo lo hace
 * `useModuloVisible` dentro de cada `ItemDeNav` (fail-open), así que acá se
 * componen todos y ninguno se descarta todavía.
 */
function componerNav(ctx: BusinessContext | null): ItemRender[] {
  return CATALOGO_NAV.map((item) => ({
    moduleKey: item.moduleKey,
    href: item.href,
    label: (item.termKey && ctx?.terminology[item.termKey]) || item.label,
    contextColor: (item.moduleKey && ctx?.moduleColors[item.moduleKey]) || 'NEUTRAL',
  }))
}

function ItemDeNav({ item, activo }: { item: ItemRender; activo: boolean }) {
  // Fail-open: mientras carga o si falló, se muestra igual.
  const visible = useModuloVisible(item.moduleKey)
  if (!visible) return null

  const color = TOKEN_DE_COLOR[item.contextColor]
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 8, fontSize: 13,
        color: activo ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: activo ? 'var(--zulu-surface-selected)' : 'transparent',
        position: 'relative',
      }}
    >
      {/* La barra de señal es lo ÚNICO que lleva el color del módulo. */}
      <span
        aria-hidden
        style={{
          position: 'absolute', left: 0, top: 6, bottom: 6, width: 3,
          borderRadius: 2,
          background: activo ? color : 'transparent',
        }}
      />
      <span style={{ width: 16, height: 16, borderRadius: 4, background: color, flex: '0 0 auto', opacity: activo ? 1 : 0.45 }} />
      {item.label}
    </div>
  )
}

function Shell() {
  const estado = useBusinessContextState()

  // Compuesta desde el catálogo local. Con contexto en `ready`; con `null` en
  // loading/error, que da labels de fallback y color NEUTRAL.
  const items = componerNav(estado.status === 'ready' ? estado.context : null)

  const rubro =
    estado.status !== 'ready' ? null
    : estado.context.industryName ?? 'Sin clasificar'

  return (
    // La grilla colapsa a una columna abajo de 768px. El tratamiento
    // responsive COMPLETO del shell (cajón, toggle, breakpoints por
    // pantalla) es V7; lo que no corresponde es construir la estructura ya
    // sabiendo que a 375px la columna de contenido queda cortada.
    <div
      className="grid grid-cols-1 md:grid-cols-[248px_1fr]"
      style={{ minHeight: 460, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}
    >
      {/* Sidebar — scope oscuro propio, no hereda la inversión de V2.5 */}
      <aside className="zulu-shell-dark" style={{ background: 'var(--zulu-surface-shell)', padding: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ padding: '4px 10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'var(--font-zulu-display)', fontSize: 15, fontWeight: 650, color: 'var(--text-primary)' }}>ZULU</span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
            {estado.status === 'loading' ? 'cargando…' : rubro ?? 'sin contexto'}
          </span>
        </div>

        {estado.status === 'loading' && (
          <div style={{ display: 'grid', gap: 6 }} aria-hidden>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: 32, borderRadius: 8 }} />
            ))}
          </div>
        )}

        {estado.status === 'ready' && items.map((it, i) => (
          <ItemDeNav key={it.href} item={it} activo={i === 1} />
        ))}

        {estado.status === 'error' && (
          <>
            {/* Fail-open: el shell muestra la navegación completa, en NEUTRAL. */}
            {items.map((it, i) => (
              <ItemDeNav key={it.href} item={it} activo={i === 1} />
            ))}
          </>
        )}
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface-1)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {estado.status === 'ready' ? (estado.context.terminology['resource.plural'] ?? 'Recursos') : 'Recursos'}
          </span>
          {estado.status === 'error' && (
            <span className="badge-pending" role="status">
              Sin contexto — se muestra todo
            </span>
          )}
        </header>

        <main style={{ padding: 18, display: 'grid', gap: 12 }}>
          {estado.status === 'loading' && (
            <>
              <div className="skeleton" style={{ height: 74, borderRadius: 12 }} />
              <div className="skeleton" style={{ height: 74, borderRadius: 12 }} />
            </>
          )}
          {estado.status === 'ready' && (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, opacity: .6 }}>
                {estado.context.terminology['reservation.singular'] ?? 'Reserva'} · {estado.context.terminology['customer.singular'] ?? 'Cliente'}
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>$284.500</div>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 10 }}>
                rubro <b>{estado.context.industryKey ?? 'null'}</b> · {estado.context.enabledModules.length} módulos ·
                grupos {estado.context.permissionGroups.join(', ')}
              </p>
            </div>
          )}
          {estado.status === 'error' && (
            <div className="alert alert-warning">
              El contexto no cargó. La navegación se muestra completa a propósito
              — el backend sigue siendo quien autoriza. Ver §5.5.2.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function ShellBench() {
  const [escenario, setEscenario] = useState<keyof typeof ESCENARIOS>('Hotelería (brass)')
  // Sin esto la fuente sería una función nueva en cada render y el efecto
  // del provider se dispararía en loop.
  const source = useMemo(() => ESCENARIOS[escenario], [escenario])

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(Object.keys(ESCENARIOS) as Array<keyof typeof ESCENARIOS>).map(k => (
          <button
            key={k}
            className={k === escenario ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setEscenario(k)}
          >
            {k}
          </button>
        ))}
      </div>

      {/*
        Sin `key`: si el provider se remontara en cada cambio de escenario,
        el reset a `loading` por cambio de fuente nunca se ejercitaría y el
        banco estaría probando algo que la app no hace. Cambiar de escenario
        acá recorre el mismo camino que un cambio de fuente real.
      */}
      <BusinessContextProvider source={source}>
        <Shell />
      </BusinessContextProvider>
    </div>
  )
}
