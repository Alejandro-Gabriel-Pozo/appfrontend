import { notFound } from 'next/navigation'
import ShellBench from './ShellBench'

/**
 * Banco del shell — V3, capa visual.
 *
 * V3 se parte en dos capas (§5.5.4 del plan de separación de dominios):
 * la estructura visual no depende del backend y arranca ya; la navegación
 * real, los labels y el color por módulo esperan a que la Fase 4 exponga
 * `GET /api/business/context`.
 *
 * Esta página construye la primera capa contra el contrato real, con una
 * fuente mockeada. Es también el único lugar donde se pueden ver los tres
 * estados: en la app de hoy `loading` y `error` son el mismo `null`.
 *
 * 404 en producción, igual que /dev/primitives.
 *
 * Uso:  npm run dev  ->  http://localhost:3000/dev/shell
 */
export default function BancoDelShell() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div className="zulu" style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-primary)', padding: 28 }}>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 650 }}>Banco del shell — V3</h1>
        <p style={{ fontSize: 13, opacity: .6, marginTop: 6, maxWidth: '82ch' }}>
          El shell contra el contrato real de <code>BusinessContext</code>, con
          fuente mockeada. Ninguna pantalla importa el mock: todo pasa por el
          provider, así que conectar la Fase 4 es cambiar la fuente, no las
          pantallas.
        </p>
        <p style={{ fontSize: 12, opacity: .5, marginTop: 6, maxWidth: '82ch' }}>
          Los escenarios cubren los tres estados del contrato y los dos casos
          de rubro que no hay que confundir: <code>GENERIC</code> es un negocio
          clasificado; <code>industryKey: null</code> es uno sin clasificar, y
          ahí no se infiere el rubro ni se cae a alojamiento.
        </p>
      </header>

      <ShellBench />
    </div>
  )
}
