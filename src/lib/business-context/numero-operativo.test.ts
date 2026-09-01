import { describe, expect, it } from 'vitest'
import {
  SIN_NUMERO,
  esNumeroOperativoValido,
  formatearNumeroCrudo,
  formatearNumeroOperativo,
  resolverNumeroOperativo,
} from '@/lib/business-context/numero-operativo'
import type { BusinessContext, BusinessContextState } from '@/lib/business-context/types'

describe('esNumeroOperativoValido', () => {
  it('acepta enteros positivos', () => {
    expect(esNumeroOperativoValido(1)).toBe(true)
    expect(esNumeroOperativoValido(123)).toBe(true)
    expect(esNumeroOperativoValido(999999)).toBe(true)
    expect(esNumeroOperativoValido(1000000)).toBe(true)
  })

  it('rechaza cero, negativos y no-enteros', () => {
    expect(esNumeroOperativoValido(0)).toBe(false)
    expect(esNumeroOperativoValido(-5)).toBe(false)
    expect(esNumeroOperativoValido(1.5)).toBe(false)
  })

  it('rechaza NaN, Infinity y valores no numéricos', () => {
    expect(esNumeroOperativoValido(NaN)).toBe(false)
    expect(esNumeroOperativoValido(Infinity)).toBe(false)
    expect(esNumeroOperativoValido(-Infinity)).toBe(false)
    expect(esNumeroOperativoValido('123')).toBe(false)
    expect(esNumeroOperativoValido(null)).toBe(false)
    expect(esNumeroOperativoValido(undefined)).toBe(false)
  })
})

describe('formatearNumeroOperativo', () => {
  it('formatea con padding de 6 dígitos', () => {
    expect(formatearNumeroOperativo('RES', 123)).toBe('RES-000123')
    expect(formatearNumeroOperativo('RES', 1)).toBe('RES-000001')
    expect(formatearNumeroOperativo('CLI', 45)).toBe('CLI-000045')
  })

  it('el padding de 6 es un mínimo, nunca un techo: no trunca', () => {
    expect(formatearNumeroOperativo('RES', 999999)).toBe('RES-999999')
    expect(formatearNumeroOperativo('RES', 1000000)).toBe('RES-1000000')
    expect(formatearNumeroOperativo('RES', 12345678)).toBe('RES-12345678')
  })

  it('customerNumber null (ausencia legítima) devuelve null, no revienta', () => {
    expect(formatearNumeroOperativo('CLI', null)).toBeNull()
    expect(formatearNumeroOperativo('CLI', undefined)).toBeNull()
  })

  it('valores inválidos devuelven null igual que la ausencia, nunca lanzan', () => {
    expect(() => formatearNumeroOperativo('RES', -5)).not.toThrow()
    expect(formatearNumeroOperativo('RES', -5)).toBeNull()
    expect(formatearNumeroOperativo('RES', 0)).toBeNull()
    expect(formatearNumeroOperativo('RES', 1.5)).toBeNull()
    expect(formatearNumeroOperativo('RES', NaN)).toBeNull()
    expect(formatearNumeroOperativo('RES', Infinity)).toBeNull()
  })

  it('prefijo vacío o solo espacios: relleno sin guion colgante', () => {
    expect(formatearNumeroOperativo('', 123)).toBe('000123')
    expect(formatearNumeroOperativo('   ', 123)).toBe('000123')
  })
})

describe('formatearNumeroCrudo', () => {
  it('formatea sin prefijo ni padding: #123', () => {
    expect(formatearNumeroCrudo(123)).toBe('#123')
    expect(formatearNumeroCrudo(1)).toBe('#1')
    expect(formatearNumeroCrudo(1000000)).toBe('#1000000')
  })

  it('null/undefined y valores inválidos devuelven null, nunca lanzan', () => {
    expect(formatearNumeroCrudo(null)).toBeNull()
    expect(formatearNumeroCrudo(undefined)).toBeNull()
    expect(() => formatearNumeroCrudo(NaN)).not.toThrow()
    expect(formatearNumeroCrudo(NaN)).toBeNull()
    expect(formatearNumeroCrudo(-5)).toBeNull()
    expect(formatearNumeroCrudo(0)).toBeNull()
  })
})

describe('resolverNumeroOperativo', () => {
  const contextoHosteleria: BusinessContext = {
    businessId: 'b-test',
    industryKey: 'HOSPITALITY',
    industryName: 'Hotelería',
    enabledModules: [],
    moduleSources: {},
    moduleColors: {
      ALOJAMIENTO: 'NEUTRAL',
      POS_RESTAURANTE: 'NEUTRAL',
      FACTURACION: 'NEUTRAL',
      HOUSEKEEPING: 'NEUTRAL',
      CUENTAS_CORRIENTES: 'NEUTRAL',
      REPORTES: 'NEUTRAL',
    },
    terminology: {},
    permissionGroups: [],
    locale: 'es-AR',
    currency: 'ARS',
    timezone: 'America/Argentina/Buenos_Aires',
    reservationNumberPrefix: 'RES',
    customerNumberPrefix: 'CLI',
  }

  const obtenerPrefijoReserva = (ctx: BusinessContext) => ctx.reservationNumberPrefix
  const obtenerPrefijoCliente = (ctx: BusinessContext) => ctx.customerNumberPrefix

  it('ready: formatea con el prefijo real del contexto', () => {
    const estado: BusinessContextState = { status: 'ready', context: contextoHosteleria }
    expect(resolverNumeroOperativo(estado, obtenerPrefijoReserva, 123)).toBe('RES-000123')
    expect(resolverNumeroOperativo(estado, obtenerPrefijoCliente, 45)).toBe('CLI-000045')
  })

  it('ready con customerNumber null: null, no un string a medio formatear', () => {
    const estado: BusinessContextState = { status: 'ready', context: contextoHosteleria }
    expect(resolverNumeroOperativo(estado, obtenerPrefijoCliente, null)).toBeNull()
  })

  it('error: fallback crudo #123, nunca inventa el prefijo RES/CLI', () => {
    const estado: BusinessContextState = { status: 'error', error: new Error('boom') }
    expect(resolverNumeroOperativo(estado, obtenerPrefijoReserva, 123)).toBe('#123')
    expect(resolverNumeroOperativo(estado, obtenerPrefijoCliente, 45)).toBe('#45')
  })

  it('error con número null: null, no "#null"', () => {
    const estado: BusinessContextState = { status: 'error', error: new Error('boom') }
    expect(resolverNumeroOperativo(estado, obtenerPrefijoReserva, null)).toBeNull()
  })

  it('loading: null — la pantalla decide su propio esqueleto, esto no adivina', () => {
    const estado: BusinessContextState = { status: 'loading' }
    expect(resolverNumeroOperativo(estado, obtenerPrefijoReserva, 123)).toBeNull()
  })
})

describe('SIN_NUMERO', () => {
  it('es el em-dash usado en el resto del repo para valores ausentes', () => {
    expect(SIN_NUMERO).toBe('—')
  })
})
