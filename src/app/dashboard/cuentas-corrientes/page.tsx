'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { customersApi, customerAccountApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import FacturarButton from '@/components/FacturarButton'
import { useNumeroOperativo } from '@/lib/business-context/numero-operativo'
import type { Customer, CustomerStatement, TransactionType, TransactionStatus, OutstandingInvoice, FinancialTransaction } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Acento clay (mismo criterio que Órdenes/Productos — plata/POS).

const TYPE_LABEL: Record<TransactionType, string> = {
  CHARGE: 'Cargo',
  PAYMENT: 'Pago',
  REFUND: 'Reembolso',
  ADJUSTMENT: 'Ajuste',
}

const STATUS_LABEL: Record<TransactionStatus, string> = {
  PENDING: 'Pendiente',
  SETTLED: 'Confirmado',
  FAILED: 'Fallido',
  VOIDED: 'Anulado',
}

// Semáforo Bastión: pendiente=brass, confirmado=sage, fallido=clay, anulado=gris.
const STATUS_BADGE_CLASS: Record<TransactionStatus, string> = {
  PENDING: 'badge-pending',
  SETTLED: 'badge-confirmed',
  FAILED: 'badge-cancelled',
  VOIDED: 'badge-completed',
}

const fmtMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', hour12: false })
}

// F1-Pieza 2 (23/08/2026, pendientes-2026-08-23.md) — trazabilidad de folio:
// a qué documento pertenece cada cargo. Reserva y estadía no tienen pantalla
// de detalle propia todavía (ver D6/backlog) así que quedan como etiqueta;
// Orden sí (dashboard/ordenes/[id]), así que se linkea. Mutuamente
// excluyentes en la práctica -- ningún sitio de creación real setea
// reservationId y orderId a la vez.
function OrigenCell({ tx }: { tx: FinancialTransaction }) {
  // D6 C2 (01/09/2026): antes armaba "#123" a mano. Ahora usa el helper
  // único con el prefijo real del tenant ("RES-000123"). Sin rama de
  // `cargando` a propósito (decisión del dueño, C6.1): mientras el
  // contexto carga se ve "Reserva" y el sufijo aparece cuando está listo
  // -- nunca miente diciendo "sin número", pero tampoco bloquea la celda
  // con un esqueleto en medio de una frase.
  const { formatearReserva } = useNumeroOperativo()
  if (tx.reservationId) {
    const numero = formatearReserva(tx.reservationNumber)
    return (
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Reserva{numero ? ` ${numero}` : ''}
      </span>
    )
  }
  if (tx.orderId) {
    return (
      <Link href={`/dashboard/ordenes/${tx.orderId}`} className="text-xs" style={{ color: 'var(--zulu-link)' }}>
        Orden →
      </Link>
    )
  }
  if (tx.stayId) {
    return <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Estadía</span>
  }
  return <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
}

export default function CuentasCorrientesPage() {
  const { toast } = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState<Customer | null>(null)
  const [statement, setStatement] = useState<CustomerStatement | null>(null)
  const [loadingStatement, setLoadingStatement] = useState(false)

  // INVOICE-CHARGES-BUTTON-DEADEND-01 (11/09/2026, opción B) -- lookup
  // financialTransactionId -> invoiceId de la consolidada, para el link
  // preciso de FacturarButton. Ausente/vacío con un backend viejo -- el
  // botón cae solo, no hace falta un guard acá.
  const coveredInvoiceIdByFt = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of statement?.coveredByConsolidatedInvoices ?? []) map.set(c.financialTransactionId, c.invoiceId)
    return map
  }, [statement])

  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paying, setPaying] = useState(false)
  // D-10 (17/09/2026, app-main docs/auditoria-integral-fase15-2026-09-16.md
  // -- Wave 8) -- generada al ABRIR el formulario (openPay()), no en el
  // submit: reintentos del MISMO envío (el operador vuelve a apretar
  // "Registrar" tras un 500/timeout, sin cerrar el modal) mandan la misma
  // clave y el backend los deduplica. Antes se generaba con
  // crypto.randomUUID() dentro del handler del submit -- cada click
  // producía una clave nueva, así que protegía el caso que casi nunca pasa
  // (un reintento automático de red -- lib/http.ts no tiene ninguno) y no
  // protegía el que sí pasa (el reintento humano). El reset explícito para
  // un operador que quiere registrar DOS pagos legítimamente idénticos
  // seguidos es cerrar y reabrir el modal -- openPay() ya corre en cada
  // click de "Registrar pago" y ya resetea payAmount/payNotes/allocations,
  // así que generar la clave ahí mismo no agrega un paso nuevo.
  const [payIdempotencyKey, setPayIdempotencyKey] = useState('')

  // I4 (23/08/2026, pendientes-2026-08-23.md — conciliación de pagos,
  // verificación de auditoría externa): "Registrar Pago" deja de ser una
  // acción ciega — lista las facturas ISSUED pendientes de cobro del
  // cliente y deja elegir cuáles salda este pago (y cuánto de cada una).
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  // invoiceId -> monto asignado (string, tal como lo tipea el usuario)
  const [allocations, setAllocations] = useState<Record<string, string>>({})

  // F1-Pieza 1 (23/08/2026, pendientes-2026-08-23.md) — filtro RÍGIDO de
  // base de datos, no de UI: `currentAccountEnabled: true` hace que el
  // propio backend (SqlCustomerRepository.getAll()) excluya a los
  // huéspedes sin cuenta corriente habilitada. Spec del dueño: "no deben
  // aparecer en este listado general bajo ninguna circunstancia".
  useEffect(() => {
    queueMicrotask(() => {
      setLoadingCustomers(true)
      customersApi.list({ currentAccountEnabled: true })
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

  const loadStatement = useCallback(async (customer: Customer) => {
    setSelected(customer)
    setLoadingStatement(true)
    try {
      const st = await customerAccountApi.getStatement(customer.id)
      setStatement(st)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoadingStatement(false)
    }
  }, [toast])

  async function openPay() {
    if (!selected) return
    setPayAmount('')
    setPayNotes('')
    setAllocations({})
    setPayIdempotencyKey(crypto.randomUUID())
    setPayOpen(true)
    setLoadingInvoices(true)
    try {
      const invoices = await customerAccountApi.getOutstandingInvoices(selected.id)
      setOutstandingInvoices(invoices)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoadingInvoices(false)
    }
  }

  function toggleInvoice(inv: OutstandingInvoice, checked: boolean) {
    setAllocations(prev => {
      const next = { ...prev }
      if (checked) {
        const remaining = Math.max(0, (parseFloat(payAmount) || 0) - allocatedTotal)
        next[inv.invoiceId] = String(Math.min(inv.outstanding, remaining || inv.outstanding))
      } else {
        delete next[inv.invoiceId]
      }
      return next
    })
  }

  const allocatedTotal = Object.values(allocations).reduce(
    (sum, v) => sum + (parseFloat(v) || 0),
    0,
  )

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !payAmount) return
    setPaying(true)
    try {
      // idempotencyKey generada en openPay() (D-10, ver comentario del
      // state) -- NO acá. Un reintento del mismo click (el operador vuelve
      // a apretar "Registrar" tras un error, sin cerrar el modal) reusa la
      // misma clave y el backend deduplica.
      const allocationList = Object.entries(allocations)
        .map(([invoiceId, amount]) => ({ invoiceId, amount: parseFloat(amount) }))
        .filter(a => a.amount > 0)
      await customerAccountApi.recordPayment(selected.id, {
        amount: parseFloat(payAmount),
        idempotencyKey: payIdempotencyKey,
        ...(payNotes && { notes: payNotes }),
        ...(allocationList.length > 0 && { allocations: allocationList }),
      })
      toast('Pago registrado', 'success')
      setPayOpen(false)
      loadStatement(selected)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className={`zulu grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      {/* Columna izquierda: buscar/elegir cliente */}
      <div>
        <h1 className="page-title mb-1" style={{ fontSize: 20, fontWeight: 600 }}>Cuentas Corrientes</h1>
        <p className="page-subtitle mb-4">Elegí un cliente para ver su cuenta</p>
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
        ) : (
          <div className="card" style={{ overflow: 'hidden', maxHeight: '70vh', overflowY: 'auto' }}>
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => loadStatement(c)}
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
            {filtered.length === 0 && (
              <p className="text-sm px-4 py-6 text-center" style={{ color: 'var(--text-tertiary)' }}>Sin resultados</p>
            )}
          </div>
        )}
      </div>

      {/* Columna derecha: estado de cuenta */}
      <div>
        {!selected ? (
          <div className="card empty-state" style={{ padding: '96px 0' }}>
            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            <p>Elegí un cliente de la lista</p>
          </div>
        ) : loadingStatement || !statement ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg skeleton" />)}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 600 }}>{selected.fullName}</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.email}</p>
              </div>
              <button onClick={openPay} className="btn-primary">Registrar pago</button>
            </div>

            <div className="card p-5 mb-6">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Saldo</p>
              <p className="text-2xl font-semibold mono" style={{ color: statement.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {fmtMoney(statement.balance)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {statement.balance > 0 ? 'El cliente debe este monto' : 'Sin saldo pendiente'}
              </p>
            </div>

            {statement.transactions.length === 0 ? (
              <div className="card empty-state">
                <p>Sin movimientos todavía</p>
              </div>
            ) : (
              <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Origen</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Notas</th>
                      <th>Comprobante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.transactions.map(tx => (
                      <tr key={tx.id}>
                        <td className="mono" style={{ fontSize: 12 }}>{fmtDate(tx.createdAt)}</td>
                        <td>{TYPE_LABEL[tx.type]}</td>
                        <td><OrigenCell tx={tx} /></td>
                        <td className="mono">{fmtMoney(tx.amount)}</td>
                        <td><span className={STATUS_BADGE_CLASS[tx.status]}>{STATUS_LABEL[tx.status]}</span></td>
                        <td className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{tx.notes ?? '—'}</td>
                        <td>
                          {/* Facturar es independiente de haber cobrado (PENDING
                              es válido -- el checkout recién pasa el CHARGE a
                              SETTLED, ver outbox.handlers.ts). Un pago/reembolso/
                              ajuste no es lo que AFIP pide como comprobante acá
                              (pendientes-2026-08-18.md punto T), y un cargo
                              VOIDED/FAILED tampoco corresponde facturarlo. */}
                          {tx.type === 'CHARGE' && tx.status !== 'VOIDED' && tx.status !== 'FAILED' && (
                            <FacturarButton
                              financialTransactionId={tx.id}
                              coveredByConsolidated={statement.coveredByConsolidatedTransactionIds?.includes(tx.id) ?? false}
                              customerId={tx.customerId}
                              coveredByInvoiceId={coveredInvoiceIdByFt.get(tx.id)}
                              // INVOICE-CHARGES-GUARD-FRONTEND-RESIDUE-001 --
                              // `selected` YA ES el cliente dueño de todo el
                              // statement (esta pantalla es un estado de
                              // cuenta por cliente) -- sin fetch nuevo.
                              customerKind={selected.kind}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal registrar pago — conciliación (I4, 23/08/2026) */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Registrar pago">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="label">Monto ($)</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              className="input"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <input
              className="input"
              placeholder="Ej: efectivo, transferencia ref #123"
              value={payNotes}
              onChange={e => setPayNotes(e.target.value)}
            />
          </div>

          {/* Conciliación — qué factura(s) salda este pago. Vacío = pago
              sin destino, comportamiento previo sin cambios. */}
          {loadingInvoices ? (
            <div className="space-y-2">
              {[...Array(2)].map((_, i) => <div key={i} className="h-10 rounded-lg skeleton" />)}
            </div>
          ) : outstandingInvoices.length > 0 && (
            <div>
              <label className="label">Facturas pendientes de cobro (opcional)</label>
              <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>
                Elegí a qué factura(s) aplicar este pago. Lo que no asignes queda contra la cuenta, sin factura asociada.
              </p>
              <div className="card" style={{ maxHeight: 220, overflowY: 'auto' }}>
                {outstandingInvoices.map(inv => {
                  const checked = inv.invoiceId in allocations
                  return (
                    <div
                      key={inv.invoiceId}
                      className="flex items-center gap-3 px-3 py-2"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => toggleInvoice(inv, e.target.checked)}
                        style={{ accentColor: 'var(--zulu-form-control)' }}
                      />
                      <div className="flex-1">
                        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                          {inv.cbteNro ? `Comprobante ${String(inv.cbteNro).padStart(8, '0')}` : `Comprobante tipo ${inv.cbteTipo}`}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          Pendiente: {fmtMoney(inv.outstanding)} de {fmtMoney(inv.impTotal)}
                        </p>
                      </div>
                      {checked && (
                        <input
                          type="number"
                          min={0.01}
                          max={inv.outstanding}
                          step={0.01}
                          className="input"
                          style={{ width: 100, padding: '4px 8px' }}
                          value={allocations[inv.invoiceId]}
                          onChange={e => setAllocations(prev => ({ ...prev, [inv.invoiceId]: e.target.value }))}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-xs mt-2" style={{ color: allocatedTotal > (parseFloat(payAmount) || 0) ? 'var(--danger)' : 'var(--text-tertiary)' }}>
                Asignado: {fmtMoney(allocatedTotal)} de {fmtMoney(parseFloat(payAmount) || 0)}
                {allocatedTotal > (parseFloat(payAmount) || 0) && ' — supera el monto pagado'}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPayOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button
              type="submit"
              disabled={paying || allocatedTotal > (parseFloat(payAmount) || 0)}
              className="btn-primary flex-1"
            >
              {paying ? <span className="spinner" /> : null}
              Registrar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
