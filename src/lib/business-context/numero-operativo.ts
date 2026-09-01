'use client'
import type { BusinessContext, BusinessContextState } from './types'
import { useBusinessContextState } from './provider'

/**
 * Formato del número operativo (D6, 01/09/2026): `RES-000123` / `CLI-000045`.
 *
 * Única implementación — ninguna pantalla (reservas, clientes, cuentas
 * corrientes) arma este string por su cuenta. `reservationNumber` es
 * obligatorio en el backend; `customerNumber` puede ser `null` (ver
 * `app-main/src/clientes-finanzas/customer.entities.ts:43-55`: se excluye a
 * propósito del `ON CONFLICT DO UPDATE` para que un PATCH no lo pise con
 * `NULL`, así que el contrato declarado es nullable aunque las lecturas
 * vivas vengan pobladas). Ambas funciones de acá abajo tratan `null`
 * idéntico a un valor inválido: nunca lanzan, siempre devuelven `null` si no
 * hay nada legítimo que mostrar — la pantalla decide el fallback visual
 * (`SIN_NUMERO` para ausencia real, ver `formatearNumeroCrudo` para el caso
 * de contexto en error).
 */

/** Fallback de UI para "no hay número" en estado `ready` (no confundir con el fallback de estado `error`, que es `formatearNumeroCrudo`). */
export const SIN_NUMERO = '—'

/**
 * Único valor que la base puede haber emitido: entero positivo (secuencia
 * `NOT NULL` desde 1). Cualquier otra cosa —negativo, cero, decimal, `NaN`,
 * `Infinity`, no-numérico— es un dato corrupto, no una ausencia legítima.
 */
export function esNumeroOperativoValido(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && Number.isFinite(n) && n > 0
}

/**
 * `RES-000123`. Padding de 6 dígitos como MÍNIMO, nunca como techo: un
 * número de 7 cifras crece (`RES-1234567`), no se trunca — truncar
 * produciría un identificador con forma válida pero equivocado, y dos
 * reservas distintas podrían mostrar el mismo string.
 *
 * `null`/`undefined` (ausencia legítima, ej. `customerNumber` de un cliente
 * sin asignar todavía) y valores inválidos devuelven `null` por igual: la
 * pantalla no necesita, ni debe, distinguirlos para decidir qué mostrar.
 */
export function formatearNumeroOperativo(
  prefijo: string,
  n: number | null | undefined,
): string | null {
  if (n === null || n === undefined) return null
  if (!esNumeroOperativoValido(n)) return null
  const relleno = String(n).padStart(6, '0')
  const prefijoLimpio = prefijo.trim()
  return prefijoLimpio === '' ? relleno : `${prefijoLimpio}-${relleno}`
}

/**
 * Fallback cuando `BusinessContext` está en estado `error`: nunca hay que
 * inventar un prefijo (`RES`/`CLI` podrían no ser los de este tenant) — se
 * muestra el número crudo, sin prefijo ni padding: `#123`. Decisión del
 * dueño (01/09/2026): preferible al identificador ausente (`—`), porque
 * conserva el dato operativo real en vez de simular ausencia.
 */
export function formatearNumeroCrudo(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null
  if (!esNumeroOperativoValido(n)) return null
  return `#${n}`
}

/**
 * Resolver puro: dado el estado de `BusinessContext` y un extractor del
 * prefijo correspondiente (reserva o cliente), decide qué formatear.
 * Separado de `useNumeroOperativo()` a propósito — esto se prueba sin
 * renderizar React; el hook de abajo es sólo wiring de una línea.
 */
export function resolverNumeroOperativo(
  estado: BusinessContextState,
  obtenerPrefijo: (ctx: BusinessContext) => string,
  n: number | null | undefined,
): string | null {
  if (estado.status === 'ready') return formatearNumeroOperativo(obtenerPrefijo(estado.context), n)
  if (estado.status === 'error') return formatearNumeroCrudo(n)
  return null // loading: la pantalla muestra su propio esqueleto, no un string adivinado
}

/**
 * `formatearReserva`/`formatearCliente` ya resueltos contra el
 * `BusinessContext` actual. Usa `useBusinessContextState()` (no
 * `useBusinessContext()`, que colapsa `loading` y `error` en el mismo
 * `null`) porque las dos pantallas necesitan distinguirlos.
 */
export function useNumeroOperativo() {
  const estado = useBusinessContextState()
  return {
    formatearReserva: (n: number | null | undefined) =>
      resolverNumeroOperativo(estado, (ctx) => ctx.reservationNumberPrefix, n),
    formatearCliente: (n: number | null | undefined) =>
      resolverNumeroOperativo(estado, (ctx) => ctx.customerNumberPrefix, n),
  }
}
