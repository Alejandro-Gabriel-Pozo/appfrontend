'use client'
import { useState } from 'react'
import Link from 'next/link'
import { invoicesApi, extractErrorMessage } from '@/lib/api'
import type { Invoice } from '@/lib/types'

/**
 * Botón "Facturar" reusado en Reservas (detalle) y Cuentas Corrientes —
 * mismo componente en los dos lugares, apuntando siempre al mismo
 * `financialTransactionId` (pendientes-2026-08-18.md punto T, "qué sigue").
 *
 * POST /api/invoices es idempotente por `financialTransactionId`
 * (`invoice.service.ts`, idempotencyKey `invoice:${financialTransactionId}`)
 * — reintentar el click en una factura ya emitida POR ESTE MISMO CAMINO
 * devuelve la misma factura, nunca pide un CAE duplicado. Por eso este
 * componente no pre-consulta el estado al montar (evita N+1 en una tabla
 * con muchos cargos): el propio click hace de "consultar o crear" a la vez.
 *
 * **Corrección 11/09/2026 (INVOICE-CHARGES-GUARD-FRONTEND-02) — esa
 * idempotencia NO cubre el camino CONSOLIDADO**: un cargo ya facturado por
 * una consolidada (`POST /api/invoices/consolidated`, otra clave de
 * idempotencia) no tiene ninguna fila que este componente pueda descubrir
 * clickeando — hacerlo pediría un segundo CAE real. Por eso el padre
 * (`cuentas-corrientes`/`reservas/[id]`) pasa `coveredByConsolidated`,
 * calculado en el backend (`GET /customers/:id/account`,
 * `coveredByConsolidatedTransactionIds`) ANTES de montar este botón — la
 * única pre-consulta que existe, y es bulk (una sola query para toda la
 * tabla), no N+1 por fila.
 */
export default function FacturarButton({
  financialTransactionId,
  /**
   * `true` cuando el cargo ya está cubierto por una factura CONSOLIDADA
   * viva (`ISSUED`/`PENDING`/`FAILED_UNCERTAIN`, nunca `REJECTED` — una
   * consolidada rechazada libera el cargo, sigue siendo facturable acá).
   * Oculta el botón por completo -- mismo criterio que ERPNext/Odoo: la
   * acción de crear desaparece cuando la cobertura ya está completa.
   *
   * **`INVOICE-CHARGES-FACTURACION-SCREEN-01` (11/09/2026) -- ya
   * ENCONTRABLE, todavía no PRECISO.** Antes de este bloque no había
   * ningún camino desde acá al comprobante real (`INVOICE-CHARGES-BUTTON-DEADEND-01`).
   * Ahora el texto es un link a `/dashboard/facturacion?customerId=`
   * (pantalla nueva, `GET /api/invoices?customerId=`) -- el usuario llega
   * a la lista de comprobantes del cliente y tiene que escanearla, no hay
   * todavía un link DIRECTO cargo→factura (eso requiere exponer
   * `InvoiceRepository.resolveInvoiceLinkage()` por HTTP, bloque aparte,
   * backend + contrato cruzado, sin decidir todavía).
   */
  coveredByConsolidated = false,
  /** Necesario solo para el link de arriba -- ambos call-sites ya lo tienen en scope. */
  customerId,
}: {
  financialTransactionId: string
  coveredByConsolidated?: boolean
  customerId?: string
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notEnabled, setNotEnabled] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  async function handleDownloadPdf() {
    if (!invoice) return
    setDownloadingPdf(true)
    try {
      const blob = await invoicesApi.downloadPdf(invoice.id)
      // El viewer de artifacts bloquea descargas iniciadas por la propia
      // página, pero esto es la app real del usuario en su propio
      // navegador -- el patrón estándar de objectURL + <a> temporal aplica.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comprobante-${invoice.cbteNro ?? invoice.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErrorMessage(extractErrorMessage(err))
    } finally {
      setDownloadingPdf(false)
    }
  }

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
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs mono" style={{ color: 'var(--success)' }}>
            CAE {invoice.cae} · Cbte {invoice.cbteNro}
          </span>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn-mini btn-mini-neutral"
          >
            {downloadingPdf ? <span className="spinner" /> : null}
            PDF
          </button>
        </div>
        {errorMessage && (
          <span className="text-xs" style={{ color: 'var(--danger)' }}>{errorMessage}</span>
        )}
      </div>
    )
  }

  // INVOICE-CHARGES-GUARD-FRONTEND-02 -- solo si TODAVÍA no hay `invoice`
  // en el estado local: si el usuario ya clickeó en esta sesión (ej. la
  // cobertura cambió DESPUÉS de cargar la pantalla, carrera de baja
  // probabilidad), el estado real recién obtenido manda sobre el flag
  // pasado por el padre al montar.
  if (coveredByConsolidated && !invoice) {
    // Sin customerId (no debería pasar en los 2 call-sites reales, pero es
    // un prop opcional) cae al texto plano -- nunca un link roto.
    return customerId ? (
      <Link href={`/dashboard/facturacion?customerId=${encodeURIComponent(customerId)}`} className="text-xs" style={{ color: 'var(--zulu-link)' }}>
        Facturado (consolidado) — ver facturas
      </Link>
    ) : (
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Facturado (consolidado)</span>
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
