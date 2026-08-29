'use client'
import { useState, useEffect, useCallback } from 'react'
import ApiSection from '@/components/ApiSection'
import { apiFetch, accountsReceivableApi, customersApi, billingPolicyApi, invoicesApi, extractErrorMessage } from '@/lib/api'
import type { Customer, AccountReceivable, AccountsReceivableStatus, BillingPolicy, InvoicingScope, InvoicingTrigger, CycleFrequency } from '@/lib/types'
import { useToast } from '@/context/ToastContext'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Sin módulo propio — acento brass por defecto (sección 6 del doc).

const fmtMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : '—'
}

const AR_STATUS_LABEL: Record<AccountsReceivableStatus, string> = {
  PENDIENTE_FACTURAR: 'Pendiente de facturar',
  FACTURADO: 'Facturado',
  COBRADO: 'Cobrado',
}

/**
 * F1-Pieza 3 (23/08/2026, pendientes-2026-08-23.md) — cierra el ciclo de
 * vida de una cuenta por cobrar (PENDIENTE_FACTURAR → FACTURADO → COBRADO,
 * nunca vuelve atrás). markInvoiced/markCollected existían a nivel
 * repositorio desde antes, pero nada los usaba — la deuda quedaba en
 * PENDIENTE_FACTURAR para siempre. "Marcar facturado" es solo un cambio de
 * estado (decisión explícita del dueño: no genera ninguna factura AFIP
 * real todavía, eso queda para C1-Fase C) — invoiceRef es el N° de
 * comprobante real anotado a mano, para no perder esa trazabilidad hasta
 * que exista generación automática.
 */
function AccountsReceivableManager() {
  const { toast } = useToast()
  const [companies, setCompanies] = useState<Customer[]>([])
  const [companyId, setCompanyId] = useState('')
  const [entries, setEntries] = useState<AccountReceivable[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  // id de la fila -> N° de comprobante tipeado (solo aplica a filas PENDIENTE_FACTURAR)
  const [invoiceRefInput, setInvoiceRefInput] = useState<Record<string, string>>({})

  // BillingPolicy (C1-Fase C, 23/08/2026) -- null = todavía no cargó / la empresa usa la default.
  const [policy, setPolicy] = useState<BillingPolicy | null>(null)
  const [policyLoading, setPolicyLoading] = useState(false)
  const [policySaving, setPolicySaving] = useState(false)
  const [policyForm, setPolicyForm] = useState<{
    requiresSenaToConfirm: boolean
    invoicingScope: InvoicingScope
    invoicingTrigger: InvoicingTrigger
    cycleFrequency: CycleFrequency | ''
    cycleCustomDays: string
    dueDays: string
  }>({ requiresSenaToConfirm: true, invoicingScope: 'per_reservation', invoicingTrigger: 'on_completion', cycleFrequency: '', cycleCustomDays: '', dueDays: '0' })
  const [invoicingNow, setInvoicingNow] = useState(false)

  useEffect(() => {
    customersApi.list({})
      .then(res => setCompanies((Array.isArray(res) ? res : res.data).filter(c => c.kind === 'COMPANY')))
      .catch(err => toast(extractErrorMessage(err), 'error'))
  }, [toast])

  const loadEntries = useCallback(async (id: string) => {
    setLoadingEntries(true)
    try {
      setEntries(await accountsReceivableApi.listByCompany(id))
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoadingEntries(false)
    }
  }, [toast])

  const loadPolicy = useCallback(async (id: string) => {
    setPolicyLoading(true)
    try {
      const p = await billingPolicyApi.get(id)
      setPolicy(p)
      setPolicyForm(p ? {
        requiresSenaToConfirm: p.requiresSenaToConfirm,
        invoicingScope: p.invoicingScope,
        invoicingTrigger: p.invoicingTrigger,
        cycleFrequency: p.cycleFrequency ?? '',
        cycleCustomDays: p.cycleCustomDays != null ? String(p.cycleCustomDays) : '',
        dueDays: String(p.dueDays),
      } : { requiresSenaToConfirm: true, invoicingScope: 'per_reservation', invoicingTrigger: 'on_completion', cycleFrequency: '', cycleCustomDays: '', dueDays: '0' })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setPolicyLoading(false)
    }
  }, [toast])

  function pickCompany(id: string) {
    setCompanyId(id)
    setEntries([])
    setPolicy(null)
    if (id) { loadEntries(id); loadPolicy(id) }
  }

  async function handleSavePolicy(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId) return
    setPolicySaving(true)
    try {
      const saved = await billingPolicyApi.upsert(companyId, {
        requiresSenaToConfirm: policyForm.requiresSenaToConfirm,
        invoicingScope: policyForm.invoicingScope,
        invoicingTrigger: policyForm.invoicingTrigger,
        cycleFrequency: policyForm.cycleFrequency || null,
        cycleCustomDays: policyForm.cycleCustomDays ? parseInt(policyForm.cycleCustomDays, 10) : null,
        dueDays: parseInt(policyForm.dueDays, 10) || 0,
      })
      setPolicy(saved)
      toast('Política de facturación guardada', 'success')
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setPolicySaving(false)
    }
  }

  async function handleInvoiceNow() {
    if (!companyId) return
    setInvoicingNow(true)
    try {
      const invoice = await invoicesApi.requestConsolidated(companyId)
      toast(`Factura emitida — comprobante ${String(invoice.ptoVta).padStart(4, '0')}-${String(invoice.cbteNro).padStart(8, '0')}`, 'success')
      loadEntries(companyId)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setInvoicingNow(false)
    }
  }

  async function handleMarkInvoiced(ar: AccountReceivable) {
    setActionLoading(ar.id)
    try {
      const invoiceRef = invoiceRefInput[ar.id]?.trim()
      await accountsReceivableApi.markInvoiced(ar.id, invoiceRef || undefined)
      toast('Marcado como facturado', 'success')
      loadEntries(companyId)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarkCollected(ar: AccountReceivable) {
    setActionLoading(ar.id)
    try {
      await accountsReceivableApi.markCollected(ar.id)
      toast('Marcado como cobrado', 'success')
      loadEntries(companyId)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Gestionar cuentas por cobrar</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          Elegí una empresa para avanzar el estado de lo que se le transfirió — marcar facturado (solo estado, la emisión sigue siendo manual) y marcar cobrado (registra el pago real contra su cuenta).
        </p>
      </div>
      <div className="px-5 pb-5 border-t border-[var(--zulu-overlay-05)] pt-4 space-y-3">
        <select className="input" value={companyId} onChange={e => pickCompany(e.target.value)}>
          <option value="">Seleccioná una empresa…</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
        </select>
        {companies.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            No hay clientes marcados como empresa (kind = COMPANY).
          </p>
        )}

        {companyId && !policyLoading && (
          <form onSubmit={handleSavePolicy} className="card p-3 space-y-2" style={{ background: 'var(--bg-secondary)' }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Política de facturación</p>
              {!policy && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>usando la default</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Facturación</label>
                <select
                  className="input"
                  value={policyForm.invoicingScope}
                  onChange={e => setPolicyForm(f => ({ ...f, invoicingScope: e.target.value as InvoicingScope }))}
                >
                  <option value="per_reservation">Por reserva</option>
                  <option value="consolidated">Consolidada</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">Vence a los (días)</label>
                <input
                  type="number" min={0} className="input"
                  value={policyForm.dueDays}
                  onChange={e => setPolicyForm(f => ({ ...f, dueDays: e.target.value }))}
                />
              </div>
              <div>
                <label className="label text-xs">Disparador</label>
                <select
                  className="input"
                  value={policyForm.invoicingTrigger}
                  onChange={e => setPolicyForm(f => ({ ...f, invoicingTrigger: e.target.value as InvoicingTrigger }))}
                >
                  <option value="on_completion">Al finalizar cada reserva</option>
                  <option value="scheduled">Por ciclo (sin automatizar todavía — usar &quot;Facturar ahora&quot;)</option>
                </select>
              </div>
              <div>
                <label className="label text-xs">Ciclo</label>
                <select
                  className="input"
                  value={policyForm.cycleFrequency}
                  onChange={e => setPolicyForm(f => ({ ...f, cycleFrequency: e.target.value as CycleFrequency | '' }))}
                  disabled={policyForm.invoicingTrigger !== 'scheduled'}
                >
                  <option value="">—</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="custom_days">Cada N días</option>
                </select>
              </div>
              {policyForm.cycleFrequency === 'custom_days' && (
                <div>
                  <label className="label text-xs">N° de días</label>
                  <input
                    type="number" min={1} className="input"
                    value={policyForm.cycleCustomDays}
                    onChange={e => setPolicyForm(f => ({ ...f, cycleCustomDays: e.target.value }))}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={policyForm.requiresSenaToConfirm}
                  onChange={e => setPolicyForm(f => ({ ...f, requiresSenaToConfirm: e.target.checked }))}
                  style={{ accentColor: 'var(--zulu-form-control)' }}
                />
                Requiere seña para confirmar
              </label>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              &quot;Requiere seña&quot; y &quot;por ciclo&quot; se guardan pero todavía no tienen efecto automático — el disparo real hoy es manual, con &quot;Facturar ahora&quot; más abajo.
            </p>
            <div className="flex gap-2">
              <button type="submit" disabled={policySaving} className="btn-mini btn-mini-neutral">
                {policySaving ? <span className="spinner" /> : null} Guardar política
              </button>
              <button
                type="button"
                onClick={handleInvoiceNow}
                disabled={invoicingNow || entries.filter(e => e.status === 'PENDIENTE_FACTURAR').length === 0}
                className="btn-mini btn-mini-confirm"
                title="Emite UN comprobante AFIP cubriendo todo lo pendiente de facturar de esta empresa ahora mismo"
              >
                {invoicingNow ? <span className="spinner" /> : null} Facturar ahora
              </button>
            </div>
          </form>
        )}

        {companyId && (loadingEntries ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => <div key={i} className="h-10 rounded-lg skeleton" />)}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Esta empresa no tiene nada transferido todavía.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(ar => (
              <div key={ar.id} className="flex items-center gap-3 px-3 py-2" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{fmtMoney(ar.amount)} — {fmtDate(ar.createdAt)}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {AR_STATUS_LABEL[ar.status]}
                    {ar.invoiceRef && ` — comprobante ${ar.invoiceRef}`}
                  </p>
                </div>
                {ar.status === 'PENDIENTE_FACTURAR' && (
                  <>
                    <input
                      className="input"
                      style={{ width: 140, padding: '4px 8px' }}
                      placeholder="N° comprobante"
                      value={invoiceRefInput[ar.id] ?? ''}
                      onChange={e => setInvoiceRefInput(prev => ({ ...prev, [ar.id]: e.target.value }))}
                    />
                    <button
                      onClick={() => handleMarkInvoiced(ar)}
                      disabled={actionLoading !== null}
                      className="btn-mini btn-mini-neutral"
                    >
                      Marcar facturado
                    </button>
                  </>
                )}
                {ar.status === 'FACTURADO' && (
                  <button
                    onClick={() => handleMarkCollected(ar)}
                    disabled={actionLoading !== null}
                    className="btn-mini btn-mini-confirm"
                  >
                    Marcar cobrado
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ReportesPage() {
  const [occFrom, setOccFrom] = useState('')
  const [occTo, setOccTo] = useState('')

  const [sumFrom, setSumFrom] = useState('')
  const [sumTo, setSumTo] = useState('')
  const [sumLimit, setSumLimit] = useState('5')

  const [catFrom, setCatFrom] = useState('')
  const [catTo, setCatTo] = useState('')

  const [underFrom, setUnderFrom] = useState('')
  const [underTo, setUnderTo] = useState('')
  const [threshold, setThreshold] = useState('30')

  const [arFrom, setArFrom] = useState('')
  const [arTo, setArTo] = useState('')

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Reportes</h1>
          <p className="page-subtitle">Ocupación, resumen, categorías y recursos subutilizados</p>
        </div>
      </div>

      <div className="space-y-4">
        <ApiSection
          method="GET" title="Reporte de ocupación"
          endpoint="/api/reports/occupancy"
          onSubmit={async () => {
            const params = new URLSearchParams({ from: occFrom, to: occTo })
            const data = await apiFetch<unknown>(`/api/reports/occupancy?${params}`)
            return { status: 200, data }
          }}
          formContent={
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Desde</label><input type="datetime-local" value={occFrom} onChange={e => setOccFrom(e.target.value)} className="input" /></div>
              <div><label className="label">Hasta</label><input type="datetime-local" value={occTo} onChange={e => setOccTo(e.target.value)} className="input" /></div>
            </div>
          }
        />

        <ApiSection
          method="GET" title="Resumen general"
          endpoint="/api/reports/occupancy/summary"
          onSubmit={async () => {
            const params = new URLSearchParams({ from: sumFrom, to: sumTo, limit: sumLimit })
            const data = await apiFetch<unknown>(`/api/reports/occupancy/summary?${params}`)
            return { status: 200, data }
          }}
          formContent={
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Desde</label><input type="datetime-local" value={sumFrom} onChange={e => setSumFrom(e.target.value)} className="input" /></div>
                <div><label className="label">Hasta</label><input type="datetime-local" value={sumTo} onChange={e => setSumTo(e.target.value)} className="input" /></div>
              </div>
              <div><label className="label">Límite de resultados</label><input type="number" value={sumLimit} onChange={e => setSumLimit(e.target.value)} min={1} max={100} className="input" /></div>
            </div>
          }
        />

        <ApiSection
          method="GET" title="Ocupación por categoría"
          endpoint="/api/reports/occupancy/by-category"
          onSubmit={async () => {
            const params = new URLSearchParams({ from: catFrom, to: catTo })
            const data = await apiFetch<unknown>(`/api/reports/occupancy/by-category?${params}`)
            return { status: 200, data }
          }}
          formContent={
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Desde</label><input type="datetime-local" value={catFrom} onChange={e => setCatFrom(e.target.value)} className="input" /></div>
              <div><label className="label">Hasta</label><input type="datetime-local" value={catTo} onChange={e => setCatTo(e.target.value)} className="input" /></div>
            </div>
          }
        />

        <ApiSection
          method="GET" title="Recursos subutilizados"
          endpoint="/api/reports/occupancy/underutilized"
          onSubmit={async () => {
            const params = new URLSearchParams({ from: underFrom, to: underTo, threshold })
            const data = await apiFetch<unknown>(`/api/reports/occupancy/underutilized?${params}`)
            return { status: 200, data }
          }}
          formContent={
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Desde</label><input type="datetime-local" value={underFrom} onChange={e => setUnderFrom(e.target.value)} className="input" /></div>
                <div><label className="label">Hasta</label><input type="datetime-local" value={underTo} onChange={e => setUnderTo(e.target.value)} className="input" /></div>
              </div>
              <div>
                {/*
                  V2.6.4 — el TODO acá proponía "sage dentro de rango, brass
                  cerca del límite, danger fuera". No aplica: esto no es un
                  valor medido, es el número que el usuario ARRASTRA en un
                  slider de 0 a 100 para definir el umbral. No hay dentro ni
                  fuera de rango, así que esos tres colores comunicarían un
                  juicio que el producto no hace.
                  Es el caso de "métrica destacada": va con énfasis
                  TIPOGRÁFICO -- mono y peso -- y color de texto normal.
                */}
                <label className="label">
                  Threshold de subutilización (%):{' '}
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{threshold}%</span>
                </label>
                <input type="range" min={0} max={100} value={threshold} onChange={e => setThreshold(e.target.value)} className="w-full mt-1" style={{ accentColor: 'var(--zulu-form-control)' }} />
              </div>
            </div>
          }
        />

        <ApiSection
          method="GET" title="Cuentas por cobrar por empresa (A1)"
          endpoint="/api/reports/accounts-receivable"
          onSubmit={async () => {
            const params = new URLSearchParams({ from: arFrom, to: arTo })
            const data = await apiFetch<unknown>(`/api/reports/accounts-receivable?${params}`)
            return { status: 200, data }
          }}
          formContent={
            <div className="space-y-3">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Agrupa las transferencias a cuenta por cobrar por empresa, para el cierre de mes. La emisión de la factura sigue siendo manual.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Desde</label><input type="datetime-local" value={arFrom} onChange={e => setArFrom(e.target.value)} className="input" /></div>
                <div><label className="label">Hasta</label><input type="datetime-local" value={arTo} onChange={e => setArTo(e.target.value)} className="input" /></div>
              </div>
            </div>
          }
        />

        <AccountsReceivableManager />
      </div>
    </div>
  )
}
