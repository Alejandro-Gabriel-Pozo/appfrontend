'use client'
import { useState } from 'react'
import { invoicesApi, extractErrorMessage } from '@/lib/api'
import type { Invoice } from '@/lib/types'

/**
 * Botón "Facturar" reusado en Reservas (detalle) y Cuentas Corrientes —
 * mismo componente en los dos lugares, apuntando siempre al mismo
 * `financialTransactionId` (pendientes-2026-08-18.md punto T, "qué sigue").
 *
 * POST /api/invoices es idempotente por `financialTransactionId`
 * (`invoice.service.ts`, idempotencyKey `invoice:${financialTransactionId}`)
 * — reintentar el click en una factura ya emitida devuelve la misma
 * factura, nunca pide un CAE duplicado. Por eso este componente no
 * pre-consulta el estado al montar (evita N+1 en una tabla con muchos
 * cargos): el propio click hace de "consultar o crear" a la vez.
 */
export default function FacturarButton({ financialTransactionId }: { financialTransactionId: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notEnabled, setNotEnabled] = useState(false)

  async function handleClick() {
    setLoading(true)
    setErrorMessage(null)
    try {
      const inv = await invoicesApi.request({ financialTransactionId })
      setInvoice(inv)
      if (inv.status !== 'ISSUED') setErrorMessage(inv.errorMessage ?? 'AFIP no autorizó el comprobante')
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'MODULE_NOT_ENABLED') {
        setNotEnabled(true)
      } else {
        setErrorMessage(extractErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  if (notEnabled) {
    return <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Facturación no habilitada</span>
  }

  if (invoice?.status === 'ISSUED') {
    return (
      <span className="text-xs mono" style={{ color: 'var(--bastion-sage)' }}>
        CAE {invoice.cae} · Cbte {invoice.cbteNro}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-mini btn-mini-neutral"
      >
        {loading ? <span className="spinner" /> : null}
        {invoice ? 'Reintentar factura' : 'Facturar'}
      </button>
      {errorMessage && (
        <span className="text-xs" style={{ color: 'var(--danger)' }}>{errorMessage}</span>
      )}
    </div>
  )
}
