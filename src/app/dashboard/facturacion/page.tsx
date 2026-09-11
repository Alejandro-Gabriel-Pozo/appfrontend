'use client'
import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { customersApi, invoicesApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import type { Customer, InvoiceWithLabel } from '@/lib/types'

// ─── Sistema de diseño "ZULU" ─────────────────────────────────────────────
// Acento clay -- mismo `modules.context_color` que el backend ya resuelve
// para el módulo FACTURACION (confirmado en la BD de plataforma real,
// 11/09/2026), coherencia con el glow del ítem de nav.

/**
 * INVOICE-CHARGES-FACTURACION-SCREEN-01 (11/09/2026, gate `architecture-governor`)
 * -- hace las facturas de un cliente ENCONTRABLES desde el panel. NO cierra
 * `INVOICE-CHARGES-BUTTON-DEADEND-01` (`app-main/docs/pendientes-2026-09-10.md`):
 * el link cargo→factura preciso sigue sin existir, esto es "buscá al
 * cliente y escaneá su lista", no "acá está EL comprobante de este cargo".
 * Ese cierre completo es bloque aparte (expone `resolveInvoiceLinkage()`
 * por HTTP), backend + contrato cruzado, su propio gate.
 *
 * Cero endpoint nuevo -- reusa `GET /api/invoices?customerId=`, ya
 * existente desde O2-F2 (23/08/2026) y ya probado, solo sin consumidor de
 * frontend hasta ahora.
 */
function FacturacionContent() {
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Customer | null>(null)

  const [invoices, setInvoices] = useState<InvoiceWithLabel[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Sin filtro `currentAccountEnabled` a propósito -- a diferencia de
  // Cuentas Corrientes, acá cualquier cliente (individual o empresa) puede
  // tener facturas propias, no solo los que tienen cuenta corriente
  // habilitada.
  useEffect(() => {
    queueMicrotask(() => {
      setLoadingCustomers(true)
      customersApi.list({})
        .then(res => setCustomers(Array.isArray(res) ? res : res.data))
        .catch(err => toast(extractErrorMessage(err), 'error'))
        .finally(() => setLoadingCustomers(false))
    })
  }, [toast])

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.trim().toLowerCase()
    return customers.filter(c => c.fullName?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
  }, [customers, search])

  const loadInvoices = useCallback(async (customer: Customer) => {
    setSelected(customer)
    setLoadingInvoices(true)
    try {
      const list = await invoicesApi.listByCustomer(customer.id)
      setInvoices(list)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoadingInvoices(false)
    }
  }, [toast])

  // Preselección vía ?customerId= -- llegando desde el link "Facturado
  // (consolidado)" de FacturarButton (cuentas-corrientes o reserva).
  // queueMicrotask() -- mismo patrón que el efecto de arriba: evita
  // "Calling setState synchronously within an effect" (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => {
      const preselectId = searchParams?.get('customerId')
      if (!preselectId || loadingCustomers || selected) return
      const match = customers.find(c => c.id === preselectId)
      if (match) void loadInvoices(match)
    })
  }, [searchParams, customers, loadingCustomers, selected, loadInvoices])

  async function handleDownloadPdf(invoice: InvoiceWithLabel) {
    setDownloadingId(invoice.id)
    try {
      const blob = await invoicesApi.downloadPdf(invoice.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comprobante-${invoice.cbteNro ?? invoice.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  const fmtMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format
  const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false })

  const STATUS_LABEL: Record<string, string> = {
    ISSUED: 'Emitida', PENDING: 'Pendiente', REJECTED: 'Rechazada', FAILED_UNCERTAIN: 'Incierta',
  }
  const STATUS_BADGE_CLASS: Record<string, string> = {
    ISSUED: 'badge-confirmed', PENDING: 'badge-pending', REJECTED: 'badge-cancelled', FAILED_UNCERTAIN: 'badge-cancelled',
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
      <div className="card p-4">
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Clientes</p>
        <input
          type="search"
          className="input w-full mb-3"
          placeholder="Buscar cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {loadingCustomers ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-lg skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sin resultados</p>
        ) : (
          <div className="card" style={{ overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto' }}>
            {filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => loadInvoices(c)}
                className="w-full text-left px-4 py-3"
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: selected?.id === c.id ? 'var(--zulu-surface-selected)' : 'transparent',
                }}
              >
                <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.fullName}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{c.email}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        {!selected ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Sin cliente seleccionado.</p>
        ) : loadingInvoices ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Cargando...</p>
        ) : invoices.length === 0 ? (
          <div className="card empty-state">
            <p>{selected.fullName} no tiene comprobantes todavía</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Número</th>
                  <th>CAE</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="mono" style={{ fontSize: 12 }}>{fmtDate(inv.createdAt)}</td>
                    <td>{inv.cbteTipoLabel ?? `Comprobante tipo ${inv.cbteTipo}`}</td>
                    <td className="mono">{inv.cbteNro ?? '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{inv.cae ?? '—'}</td>
                    <td className="mono">{fmtMoney(inv.impTotal)}</td>
                    <td><span className={STATUS_BADGE_CLASS[inv.status]}>{STATUS_LABEL[inv.status]}</span></td>
                    <td>
                      {inv.status === 'ISSUED' && (
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(inv)}
                          disabled={downloadingId === inv.id}
                          className="btn-mini btn-mini-neutral"
                        >
                          {downloadingId === inv.id ? <span className="spinner" /> : null}
                          PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function FacturacionPage() {
  return (
    <div className="p-6">
      <h1 className="page-title mb-1" style={{ fontSize: 20, fontWeight: 600 }}>Facturación</h1>
      <p className="page-subtitle mb-4">Elegí un cliente para ver sus comprobantes emitidos</p>
      <Suspense fallback={<p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Cargando...</p>}>
        <FacturacionContent />
      </Suspense>
    </div>
  )
}
