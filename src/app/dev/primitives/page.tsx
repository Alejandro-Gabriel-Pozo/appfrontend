import { notFound } from 'next/navigation'
import BancoModal from './BancoModal'

/**
 * Banco de pruebas de primitives — herramienta de la corriente visual.
 *
 * Pedido del dueño al aprobar V2.5 (29/08/2026): el agente no puede hacer
 * login, así que no puede capturar el dashboard. Esta página carga el
 * `globals.css` REAL y renderiza los primitives sin autenticación, que es
 * donde está el riesgo verdadero de la inversión de polaridad: tokens,
 * contraste, estados y los consumidores de `danger`.
 *
 * NO reemplaza la verificación del shell autenticado — el banco prueba las
 * piezas, no la composición. Esa evidencia la toma el dueño levantando la
 * sesión.
 *
 * 404 en producción: es una herramienta de desarrollo, no una pantalla del
 * producto.
 *
 * Uso:  npm run dev  ->  http://localhost:3000/dev/primitives
 */

const BADGES = ['badge-active', 'badge-pending', 'badge-confirmed', 'badge-completed', 'badge-cancelled'] as const
const METODOS = ['badge-get', 'badge-post', 'badge-del'] as const
const ALERTAS = ['alert-info', 'alert-warning', 'alert-danger', 'alert-success'] as const
// Los cuatro tipos que ToastContext puede emitir. `warning` faltaba en el
// CSS: hasta V2.6.2a caía en `.toast` a secas, sin fondo.
const TOASTS = ['success', 'error', 'warning', 'info'] as const
const ICONO_TOAST: Record<(typeof TOASTS)[number], string> = {
  success: '✓', error: '✕', warning: '!', info: 'i',
}

/**
 * Consumidores del rojo, sacados del CSS -- no de memoria.
 *
 * Historia de esta lista, porque es el punto de V2.6.1: el comentario decía
 * "17 consumidores", la pantalla nombraba ocho, y de esos ocho renderizaba
 * cinco. Y uno de los ocho, "input inválido", NO EXISTE: no hay ninguna
 * regla de estado inválido en globals.css. El banco declaraba cobertura
 * sobre un componente inventado.
 *
 * La lista real salió de recorrer globals.css buscando `var(--danger*)` con
 * el mismo escáner que usa el guard: 10 selectores, todos renderizados acá
 * abajo. Si aparece uno nuevo en el CSS y no se agrega acá, esto vuelve a
 * mentir -- revisarlo cada vez que se toque el rojo.
 */
const DANGER_EN_EL_CSS = [
  'kpi-card-danger', 'kpi-trend.down', 'btn-danger', 'badge-del',
  'badge-cancelled', 'response-block.error', 'alert-danger',
  'system-rail-blocked', 'toast.error', 'btn-mini-danger',
]

function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .6, marginBottom: 10 }}>
        {titulo}
      </h2>
      {nota && <p style={{ fontSize: 12, opacity: .55, marginBottom: 10, maxWidth: '70ch' }}>{nota}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>{children}</div>
    </section>
  )
}

/** El mismo inventario se renderiza en los dos scopes, para comparar. */
function Inventario() {
  return (
    <>
      <Bloque titulo="Botones" nota="btn-primary toma el contexto de módulo; btn-danger y btn-mini-danger son destructivos.">
        <button className="btn btn-primary">Primario</button>
        <button className="btn btn-ghost">Ghost</button>
        <button className="btn btn-danger">Eliminar</button>
        <button className="btn-mini btn-mini-confirm">Confirmar</button>
        <button className="btn-mini btn-mini-danger">Cancelar</button>
        <button className="btn-mini btn-mini-neutral">Neutral</button>
      </Bloque>

      <Bloque titulo="Estados" nota="badge-active pasa a sage en V2.5; badge-cancelled es consumidor de danger.">
        {BADGES.map(b => <span key={b} className={b}>{b.replace('badge-', '')}</span>)}
      </Bloque>

      <Bloque titulo="Plano técnico" nota="badge-post queda NEUTRO por decisión del dueño; el cian solo sobre superficie oscura.">
        {METODOS.map(b => <span key={b} className={b}>{b.replace('badge-', '').toUpperCase()}</span>)}
        <span className="system-rail-healthy">healthy</span>
        <span className="system-rail-syncing">syncing</span>
        <span className="system-rail-blocked">blocked</span>
      </Bloque>

      <Bloque titulo="Alertas">
        <div style={{ display: 'grid', gap: 8, width: '100%', maxWidth: 560 }}>
          {ALERTAS.map(a => <div key={a} className={`alert ${a}`}>{a.replace('alert-', '')} — texto de ejemplo</div>)}
        </div>
      </Bloque>

      <Bloque titulo="Formulario y foco" nota="Tabulá para ver el anillo de foco: debe verse igual en superficie clara y oscura.">
        <input className="input" placeholder="Campo de texto" style={{ maxWidth: 240 }} />
        <select className="input" style={{ maxWidth: 180 }}><option>Selector</option></select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" defaultChecked style={{ accentColor: 'var(--zulu-form-control)', width: 16, height: 16 }} />
          accentColor
        </label>
        <a href="#foco" style={{ color: 'var(--zulu-link)' }}>Un hipervínculo</a>
      </Bloque>

      <Bloque titulo="Superficies y overlay" nota="Los overlays derivan de --zulu-overlay-tint: al invertir la polaridad tienen que seguir viéndose.">
        <div className="card" style={{ padding: 14, minWidth: 190 }}>
          <div style={{ fontSize: 12, opacity: .6 }}>Card</div>
          <div style={{ fontFamily: 'var(--font-zulu-mono)', fontSize: 22, fontWeight: 600 }}>$284.500</div>
        </div>
        {['02', '05', '09', '13'].map(n => (
          <div key={n} style={{ width: 76, height: 56, borderRadius: 8, background: `var(--zulu-overlay-${n})`,
                                border: '1px solid var(--border)', display: 'grid', placeItems: 'center', fontSize: 11 }}>
            {n}
          </div>
        ))}
      </Bloque>

      <Bloque
        titulo="Scrim y modal"
        nota="Los 17 scrims usan --zulu-scrim. Un scrim no es un overlay: el overlay sigue la polaridad (tinte leve), el scrim siempre oscurece porque su trabajo es bloquear. En la confirmación destructiva, el rojo es de la acción y el velo es neutro.">
        <BancoModal />
      </Bloque>

      <Bloque
        titulo="Consumidores del rojo que faltaban"
        nota="kpi-card-danger vive en el borde de la tarjeta y se enciende al pasar el mouse; kpi-trend.down en la métrica; response-block.error en la respuesta de API. Ninguno de los tres estaba en el banco.">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="kpi-card kpi-card-danger" style={{ padding: 14, minWidth: 180 }}>
            <div style={{ fontSize: 12, opacity: .6 }}>Cancelaciones</div>
            <div className="kpi-value" style={{ fontSize: 26 }}>7</div>
            <p className="kpi-trend down">▼ 12% vs. semana anterior</p>
          </div>
          <div className="response-block error" style={{ minWidth: 230 }}>
            {'{ "error": "TENANT_NOT_FOUND" }'}
          </div>
          {/*
            El .response-block SIN .error es el que estaba roto: fondo
            rgba(0,0,0,0.35) y texto #7d8799 daban 1.36 sobre la página
            clara. Se veía así en /admin y en Reportes cada vez que una
            llamada respondía bien, y no había forma de mirarlo desde acá
            porque las dos pantallas están detrás del login. V2.6.2c.
          */}
          <div className="response-block" style={{ minWidth: 230 }}>
            {'{ "ok": true, "reservas": 3 }'}
          </div>
        </div>
      </Bloque>

      <Bloque
        titulo="Toasts"
        nota="Regresión de V2.5 corregida acá: tenían fondo oscuro traslúcido compuesto sobre la página, y al invertir la polaridad toast.error cayó a 2.57. Ahora el relleno es opaco, así el contraste no depende del fondo. Desde V2.6.2a ya no hace falta forzar position: la posición vive en .toast-stack y .toast es sólo apariencia, así que esto es exactamente lo que se ve en la app.">
        <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
          {TOASTS.map(t => (
            <div key={t} className={`toast ${t}`}>
              <span aria-hidden style={{ fontWeight: 700 }}>{ICONO_TOAST[t]}</span>
              toast {t} — texto de ejemplo
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Tabla">
        <table className="table" style={{ width: '100%', maxWidth: 620 }}>
          <thead><tr><th>N°</th><th>Recurso</th><th>Total</th><th>Estado</th></tr></thead>
          <tbody>
            <tr><td className="mono">RES-000841</td><td>102 · Doble</td><td className="mono">$96.000</td><td><span className="badge-confirmed">confirmada</span></td></tr>
            <tr><td className="mono">RES-000844</td><td>105 · Suite</td><td className="mono">$143.000</td><td><span className="badge-cancelled">cancelada</span></td></tr>
          </tbody>
        </table>
      </Bloque>
    </>
  )
}

export default function BancoDePrimitives() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-primary)', padding: 28 }}>
      <header style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 650 }}>Banco de primitives — corriente visual ZULU Hub</h1>
        <p style={{ fontSize: 13, opacity: .6, marginTop: 6, maxWidth: '80ch' }}>
          Carga el <code>globals.css</code> real. Sirve para verificar tokens, contraste y estados sin
          autenticación. No prueba la composición del shell — eso necesita sesión.
        </p>
        <p style={{ fontSize: 12, opacity: .5, marginTop: 6 }}>
          Los {DANGER_EN_EL_CSS.length} consumidores del rojo que hay en <code>globals.css</code>, todos
          renderizados abajo: {DANGER_EN_EL_CSS.join(' · ')}.
        </p>
      </header>

      <div style={{ marginBottom: 34, paddingBottom: 22, borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
          Scope <code>.zulu</code> — el del dashboard (34 pantallas)
        </h2>
        <div className="zulu"><Inventario /></div>
      </div>

      <div style={{ marginBottom: 34, paddingBottom: 22, borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
          Sin scope — portal, auth y Superadmin (19 pantallas)
        </h2>
        <Inventario />
      </div>

      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
          Superficie oscura — el scope del sidebar
        </h2>
        <p style={{ fontSize: 12, opacity: .55, marginBottom: 12, maxWidth: '70ch' }}>
          Acá se verifica <code>link-on-dark</code>, el foco sobre oscuro y el cian técnico, que son
          las tres señales que sobre claro no funcionan. Solo se muestra lo que de verdad vive en el
          sidebar: <code>SystemRail</code> está en el header (<code>layout.tsx:618</code>, fuera del
          <code>&lt;aside&gt;</code> que va de la 400 a la 550), o sea sobre superficie clara. Ponerlo
          acá daba un falso negativo de contraste — una superficie <code>*-soft</code> clara con el
          texto blanco del scope oscuro.
        </p>
        <div className="zulu zulu-shell-dark" style={{ background: 'var(--zulu-surface-shell)', padding: 20, borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href="#dark" style={{ color: 'var(--zulu-link)' }}>Link sobre oscuro</a>
            <button className="btn btn-ghost">Foco (tabulá)</button>
            <span className="system-rail-syncing">syncing</span>
            <span style={{ color: 'var(--zulu-technical)', fontFamily: 'var(--font-zulu-mono)', fontSize: 13 }}>
              api · telemetría
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
