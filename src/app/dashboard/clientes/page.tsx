'use client'
import { useState, useEffect } from 'react'
import { useTable, useCreate } from '@refinedev/core'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { customersApi, extractErrorMessage } from '@/lib/api'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/Modal'
import { useNumeroOperativo, SIN_NUMERO } from '@/lib/business-context/numero-operativo'
import type { Customer } from '@/lib/types'

// ─── Sistema de diseño "ZULU" (ex-Bastión, migrado 23/08/2026) ───────────────
// Sin módulo propio — acento brass por defecto (sección 6 del doc).

const KIND_LABEL: Record<'INDIVIDUAL' | 'COMPANY', string> = {
  INDIVIDUAL: 'Individual',
  COMPANY: 'Empresa',
}

export default function ClientesPage() {
  const { toast } = useToast()
  const router = useRouter()
  const {
    result, tableQuery,
    currentPage, setCurrentPage, pageCount,
    setFilters,
  } = useTable<Customer>({ resource: 'clientes', pagination: { mode: 'server', pageSize: 20 } })
  const customers = result.data
  const loading = tableQuery.isLoading
  const { mutateAsync: createCustomer } = useCreate<Customer>()
  const { cargando: cargandoNumero, formatearCliente } = useNumeroOperativo()
  const [search, setSearch] = useState('')
  // G1 (23/08/2026) — si lo que se tipeó son solo dígitos (7+, forma de un
  // CUIT/DNI), se busca contra customer_tax_profiles en el backend en vez
  // de filtrar por nombre/email en memoria -- el CUIT/DNI de un cliente no
  // viaja en la lista que ya se cargó, hay que pedirlo aparte.
  const [taxIdMatches, setTaxIdMatches] = useState<Customer[] | null>(null)

  // Crear cliente
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ fullName: '', email: '' })
  const [creating, setCreating] = useState(false)

  // K2 (23/08/2026) — Clientes pasó a paginación server-side. El buscador
  // sigue siendo un único campo, con dos caminos server-side distintos
  // (mismo debounce de 400ms de siempre, un solo efecto):
  // - 7+ dígitos → CUIT/DNI, va a customers_tax_profiles (G1, exacto).
  // - lo demás → filtro `search` (nombre O email) de GET /customers, ya
  //   soportado por el backend (customer.repository.ts).
  useEffect(() => {
    const digitsOnly = search.trim().replace(/[-\s.]/g, '')
    const looksLikeTaxId = digitsOnly.length >= 7 && /^\d+$/.test(digitsOnly)
    const timer = setTimeout(() => {
      setCurrentPage(1)
      if (looksLikeTaxId) {
        customersApi.searchByTaxId(digitsOnly)
          .then(setTaxIdMatches)
          .catch(err => toast(extractErrorMessage(err), 'error'))
        setFilters([{ field: 'search', operator: 'contains', value: undefined }])
      } else {
        setTaxIdMatches(null)
        setFilters([{ field: 'search', operator: 'contains', value: search.trim() || undefined }])
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [search, toast, setCurrentPage, setFilters])

  // Con paginación server-side, `customers` ya viene filtrado por el
  // backend (search) — acá solo se elige entre esa página y los matches
  // exactos de CUIT/DNI (que no paginan, son unos pocos resultados).
  const filtered = taxIdMatches !== null ? taxIdMatches : customers

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await createCustomer({ resource: 'clientes', values: createForm })
      toast('Cliente creado', 'success')
      setCreateOpen(false)
      setCreateForm({ fullName: '', email: '' })
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={`zulu`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Clientes</h1>
          <p className="page-subtitle">Gestión de clientes, tipo de cuenta y etiquetas</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cliente
        </button>
      </div>

      <div className="mb-4">
        <input
          type="search"
          className="input w-full max-w-xs"
          placeholder="Buscar por nombre, email o CUIT/DNI…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded-lg skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4" />
          </svg>
          <p>{search ? 'Sin resultados para esa búsqueda' : 'Sin clientes todavía'}</p>
        </div>
      ) : (
        <div className="card table-wrapper" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>N.º</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/dashboard/clientes/${c.id}`)}>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {cargandoNumero
                      ? <span className="skeleton" style={{ display: 'inline-block', width: 76, height: 12 }} />
                      : (formatearCliente(c.customerNumber) ?? SIN_NUMERO)}
                  </td>
                  <td className="table-cell-primary">{c.fullName}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{c.email}</td>
                  <td><span className="badge-completed">{KIND_LABEL[c.kind ?? 'INDIVIDUAL']}</span></td>
                  <td>
                    {(c.active ?? true) ? (
                      <span className="badge-confirmed">Activo</span>
                    ) : (
                      <span className="badge-completed">Inactivo</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <Link href={`/dashboard/clientes/${c.id}`} className="btn-mini btn-mini-neutral" style={{ textDecoration: 'none' }}>Ver detalle</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación — la búsqueda por CUIT/DNI no pagina (son unos pocos matches exactos) */}
      {taxIdMatches === null && pageCount > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span style={{ color: 'var(--text-tertiary)' }}>
            {result.total ?? filtered.length} resultado{(result.total ?? filtered.length) !== 1 ? 's' : ''} · página {currentPage} de {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-secondary"
              style={{ padding: '6px 12px' }}
            >
              ← Anterior
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
              disabled={currentPage === pageCount}
              className="btn-secondary"
              style={{ padding: '6px 12px' }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Modal nuevo cliente */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo cliente">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Nombre completo</label>
            <input className="input" value={createForm.fullName} onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Juan García" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="juan@email.com" required />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={creating} className="btn-primary flex-1">
              {creating ? <span className="spinner" /> : null}
              Crear cliente
            </button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
