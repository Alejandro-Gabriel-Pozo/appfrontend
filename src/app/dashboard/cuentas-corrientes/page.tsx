'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { customersApi, customerAccountApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import FacturarButton from '@/components/FacturarButton'
import type { Customer, CustomerStatement, TransactionType, TransactionStatus } from '@/lib/types'

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

export default function CuentasCorrientesPage() {
  const { toast } = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [search, setSearch] = useState('')

  const [selected, setSelected] = useState<Customer | null>(null)
  const [statement, setStatement] = useState<CustomerStatement | null>(null)
  const [loadingStatement, setLoadingStatement] = useState(false)

  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [paying, setPaying] = useState(false)

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

  function openPay() {
    setPayAmount('')
    setPayNotes('')
    setPayOpen(true)
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !payAmount) return
    setPaying(true)
    try {
      // idempotencyKey generada acá — si el pedido se reintenta por un
      // corte de red, el backend no duplica el pago.
      const idempotencyKey = crypto.randomUUID()
      await customerAccountApi.recordPayment(selected.id, {
        amount: parseFloat(payAmount),
        idempotencyKey,
        ...(payNotes && { notes: payNotes }),
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
                  background: selected?.id === c.id ? 'var(--accent-dim)' : 'transparent',
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
                            <FacturarButton financialTransactionId={tx.id} />
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

      {/* Modal registrar pago */}
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
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setPayOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={paying} className="btn-primary flex-1">
              {paying ? <span className="spinner" /> : null}
              Registrar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
