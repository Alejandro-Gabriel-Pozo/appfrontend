'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { BusinessContext, BusinessContextSource, BusinessContextState } from './types'

/**
 * Proveedor de `BusinessContext` — V3.
 *
 * La fuente es REEMPLAZABLE a propósito (pedido del dueño al aprobar V3):
 * mock en desarrollo visual, endpoint real en integración. Ninguna pantalla
 * importa el mock: importan este hook, y quién le da los datos se decide en
 * el árbol, arriba.
 *
 * Eso es lo que permite construir el shell antes de que exista
 * `GET /api/business/context` sin crear deuda: cuando la Fase 4 lo exponga,
 * cambia la fuente y no las pantallas.
 *
 * Ver `app-main/docs/plan-separacion-dominios-multirubro-2026-08-28.md`
 * §5.4 y §5.5.
 */

const Ctx = createContext<BusinessContextState>({ status: 'loading' })

export function BusinessContextProvider({
  source,
  children,
}: {
  source: BusinessContextSource
  children: ReactNode
}) {
  const [state, setState] = useState<BusinessContextState>({ status: 'loading' })

  // Si cambia la fuente hay que volver a `loading`. Se hace DURANTE el
  // render y no dentro del efecto: `setState` síncrono en un efecto encadena
  // renders, y además dejaría un frame mostrando el contexto viejo con la
  // fuente nueva. Es el patrón de React para estado derivado de props.
  // Ojo con los `() =>`: la fuente ES una función, así que `useState(source)`
  // la tomaría como inicializador perezoso y la EJECUTARÍA, y
  // `setFuenteAnterior(source)` la tomaría como updater. Las dos formas hay
  // que envolverlas. (tsc lo cazó: comparaba la función contra una Promise.)
  const [fuenteAnterior, setFuenteAnterior] = useState(() => source)
  if (source !== fuenteAnterior) {
    setFuenteAnterior(() => source)
    setState({ status: 'loading' })
  }

  useEffect(() => {
    let vigente = true
    source()
      .then((context) => { if (vigente) setState({ status: 'ready', context }) })
      .catch((e) => {
        if (!vigente) return
        setState({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) })
      })
    return () => { vigente = false }
  }, [source])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}

/** El estado completo. Usalo cuando necesites distinguir loading de error. */
export function useBusinessContextState(): BusinessContextState {
  return useContext(Ctx)
}

/** El contexto, o `null` si todavía no está. Atajo para lectura simple. */
export function useBusinessContext(): BusinessContext | null {
  const s = useContext(Ctx)
  return s.status === 'ready' ? s.context : null
}

/**
 * ¿Se muestra este ítem de navegación?
 *
 * FAIL-OPEN, igual que hoy: mientras carga o si falló, se muestra todo. El
 * gate real es el backend, que responde 402 MODULE_NOT_ENABLED; ocultar de
 * más deja al usuario sin camino a una función que sí tiene.
 *
 * Que esto devuelva `true` NO significa que la capacidad esté habilitada.
 * No usarlo como autorización.
 */
export function useModuloVisible(moduleKey: string | null): boolean {
  const s = useContext(Ctx)
  if (moduleKey === null) return true
  if (s.status !== 'ready') return true
  return (s.context.enabledModules as string[]).includes(moduleKey)
}

/**
 * Traduce una clave de terminología. Cae a `fallback` mientras no haya
 * contexto -- nunca muestra la clave cruda en pantalla.
 */
export function useTermino(clave: string, fallback: string): string {
  const ctx = useBusinessContext()
  return ctx?.terminology[clave] ?? fallback
}
