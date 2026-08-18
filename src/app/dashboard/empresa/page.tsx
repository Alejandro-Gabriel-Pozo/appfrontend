'use client'
import { useState, useEffect, useCallback } from 'react'
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import { companiesApi, productsApi, extractErrorMessage } from '@/lib/api'
import type { CompanyLink, CompanyProduct } from '@/lib/types'
import { useToast } from '@/context/ToastContext'

// ─── Sistema de diseño "Bastión" (docs/sistema-diseno-bastion.md) ────────────
// Acento brass por defecto (sin módulo propio — el vínculo a empresa aplica
// más allá de un solo módulo POS/PMS).
const fraunces = Fraunces({ subsets: ['latin'], weight: ['300', '500', '600'], variable: '--font-bastion-serif' })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-bastion-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-bastion-mono' })

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

export default function EmpresaPage() {
  const { toast } = useToast()
  const [link, setLink] = useState<CompanyLink | null>(null)
  const [catalog, setCatalog] = useState<CompanyProduct[]>([])
  const [loading, setLoading] = useState(true)

  const [newCompanyName, setNewCompanyName] = useState('')
  const [linkCompanyId, setLinkCompanyId] = useState('')
  const [creating, setCreating] = useState(false)
  const [linking, setLinking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [companyLink, cat] = await Promise.all([
        companiesApi.me(),
        productsApi.companyCatalog(),
      ])
      setLink(companyLink)
      setCatalog(cat)
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { queueMicrotask(load) }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const company = await companiesApi.create(newCompanyName.trim())
      toast(`Empresa "${company.name}" creada — compartí este ID con tus otras sucursales: ${company.id}`, 'success')
      setNewCompanyName('')
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault()
    setLinking(true)
    try {
      await companiesApi.link(linkCompanyId.trim())
      toast('Negocio vinculado a la empresa', 'success')
      setLinkCompanyId('')
      load()
    } catch (err) {
      toast(extractErrorMessage(err), 'error')
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className={`bastion ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`} style={{ margin: -24, padding: 32, minHeight: 'calc(100% + 48px)' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ fontSize: 22, fontWeight: 600 }}>Empresa</h1>
          <p className="page-subtitle">
            Vinculá este negocio con tus otras sucursales para compartir un catálogo de productos siempre-sincronizado
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card p-4 h-32 skeleton" />
      ) : !link?.companyId ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 760 }}>
          <div className="card p-5">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Crear una empresa nueva</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Usalo si esta es tu PRIMERA sucursal. Vas a recibir un ID para vincular las demás.
            </p>
            <form onSubmit={handleCreate} className="space-y-3">
              <input className="input" placeholder="Nombre de la empresa" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} required />
              <button type="submit" disabled={creating || !newCompanyName.trim()} className="btn-primary">
                {creating ? <span className="spinner" /> : null}
                Crear empresa
              </button>
            </form>
          </div>
          <div className="card p-5">
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Vincular a una empresa existente</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Usalo si otra de tus sucursales ya creó la empresa — pedile el ID.
            </p>
            <form onSubmit={handleLink} className="space-y-3">
              <input className="input mono" placeholder="ID de la empresa" value={linkCompanyId} onChange={e => setLinkCompanyId(e.target.value)} required />
              <button type="submit" disabled={linking || !linkCompanyId.trim()} className="btn-primary">
                {linking ? <span className="spinner" /> : null}
                Vincular
              </button>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div className="card p-5 mb-6" style={{ maxWidth: 760 }}>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{link.companyName}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              ID para vincular otra sucursal: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{link.companyId}</span>
            </p>
          </div>

          <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Catálogo compartido — {catalog.length} producto{catalog.length !== 1 ? 's' : ''}
          </p>
          {catalog.length === 0 ? (
            <div className="card empty-state">
              <p>Sin productos compartidos todavía. Cualquier producto nuevo que crees en esta sucursal se comparte automáticamente. Para uno que ya existía, usá &quot;Compartir&quot; en Productos.</p>
            </div>
          ) : (
            <div className="card table-wrapper" style={{ overflow: 'hidden', maxWidth: 760 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>SKU</th>
                    <th>Precio maestro</th>
                    <th>Última actualización</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map(c => (
                    <tr key={c.id}>
                      <td className="table-cell-primary">{c.name}</td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.sku ?? '—'}</td>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--bastion-sage)' }}>{fmt(c.basePrice)}</td>
                      <td className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{new Date(c.updatedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
