'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { customersApi, customerAccountApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import type { Customer, CustomerStatement, TransactionType, TransactionStatus } from '@/lib/types'

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

const STATUS_CLASS: Record<TransactionStatus, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-400',
  SETTLED: 'bg-emerald-500/10 text-emerald-400',
  FAILED: 'bg-red-500/10 text-red-400',
  VOIDED: 'bg-slate-500/10 text-slate-400',
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

  useEffect(() => {
    setLoadingCustomers(true)
    customersApi.list()
      .then(res => setCustomers(Array.isArray(res) ? res : res.data))
      .catch(err => toast(extractErrorMessage(err), 'error'))
      .finally(() => setLoadingCustomers(false))
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
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Columna izquierda: buscar/elegir cliente */}
      <div>
        <h1 className="text-xl font-semibold text-white mb-1">Cuentas Corrientes</h1>
        <p className="text-sm text-slate-400 mb-4">Elegí un cliente para ver su cuenta</p>
        <input
          type="search"
          className="input w-full mb-3"
          placeholder="Buscar cliente…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {loadingCustomers ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-white/[0.04] animate-pulse" />)}
          </div>
        ) : (
          <div className="card overflow-hidden max-h-[70vh] overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c.id}
                onClick={() => loadStatement(c)}
                className={`w-full text-left px-4 py-3 border-b border-white/[0.04] last:border-0 transition-colors ${
                  selected?.id === c.id ? 'bg-emerald-500/10' : 'hover:bg-white/[0.03]'
                }`}
              >
                <p className="text-sm font-medium text-white">{c.fullName}</p>
                <p className="text-xs text-slate-500">{c.email}</p>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-slate-500 px-4 py-6 text-center">Sin resultados</p>
            )}
          </div>
        )}
      </div>

      {/* Columna derecha: estado de cuenta */}
      <div>
        {!selected ? (
          <div className="card flex flex-col items-center justify-center py-24 text-center">
            <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-400 font-medium">Elegí un cliente de la lista</p>
          </div>
        ) : loadingStatement || !statement ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-white/[0.04] animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{selected.fullName}</h2>
                <p className="text-sm text-slate-400">{selected.email}</p>
              </div>
              <button onClick={openPay} className="btn-primary">Registrar pago</button>
            </div>

            <div className="card p-5 mb-6">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Saldo</p>
              <p className={`text-2xl font-semibold ${statement.balance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {fmtMoney(statement.balance)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {statement.balance > 0 ? 'El cliente debe este monto' : 'Sin saldo pendiente'}
              </p>
            </div>

            {statement.transactions.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <p className="text-slate-400 font-medium">Sin movimientos todavía</p>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Monto</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {statement.transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3.5 text-slate-400 text-xs tabular-nums">{fmtDate(tx.createdAt)}</td>
                        <td className="px-4 py-3.5 text-slate-200">{TYPE_LABEL[tx.type]}</td>
                        <td className="px-4 py-3.5 text-slate-200 tabular-nums">{fmtMoney(tx.amount)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[tx.status]}`}>
                            {STATUS_LABEL[tx.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs">{tx.notes ?? '—'}</td>
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
