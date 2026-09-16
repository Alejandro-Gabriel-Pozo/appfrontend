'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/context/CustomerAuthContext'
import { availabilityApi, customerCategoriesApi, extractErrorMessage } from '@/lib/customerApi'
import { savePendingBooking } from '@/lib/pendingBooking'
import type { AvailabilityResource, Category } from '@/lib/types'

function defaultStart(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000) // en 1 hora
  d.setMinutes(0, 0, 0)
  return d.toISOString().slice(0, 16)
}

function defaultEnd(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000) // en 2 horas
  d.setMinutes(0, 0, 0)
  return d.toISOString().slice(0, 16)
}

export default function DisponibilidadPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.businessSlug as string
  const { customer } = useCustomerAuth()

  const [startTime, setStartTime] = useState(defaultStart())
  const [endTime, setEndTime]     = useState(defaultEnd())
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])

  const [results, setResults] = useState<AvailabilityResource[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // El filtro de categoría solo está disponible logueado: GET /api/customer/categories
  // requiere sesión de cliente (endpoint dedicado del portal, Wave 2 P-01/D-03
  // en app-main, 16/09/2026 -- antes pegaba a la ruta de STAFF /api/categories).
  useEffect(() => {
    if (!customer) return
    customerCategoriesApi.list().then(setCategories).catch(() => { /* no bloquea la búsqueda */ })
  }, [customer])

  const search = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const startIso = new Date(startTime).toISOString()
      const endIso   = new Date(endTime).toISOString()
      const res = await availabilityApi.search(slug, {
        startTime: startIso,
        endTime: endIso,
        categoryId: categoryId || undefined,
      })
      setResults(res.available)
    } catch (err: unknown) {
      setError(extractErrorMessage(err))
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [slug, startTime, endTime, categoryId])

  function reservar(resource: AvailabilityResource) {
    savePendingBooking({
      resourceId: resource.id,
      categoryId: resource.categoryId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    })
    if (customer) {
      router.push(`/portal/${slug}/cuenta/reservas?prefill=1`)
    } else {
      router.push(`/portal/${slug}/register`)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Disponibilidad</h1>
          <p className="page-subtitle">Buscá y reservá sin necesidad de llamar</p>
        </div>
        <div className="flex gap-2">
          {customer ? (
            <Link href={`/portal/${slug}/cuenta/reservas`} className="btn-secondary">Mis reservas</Link>
          ) : (
            <>
              <Link href={`/portal/${slug}/login`} className="btn-secondary">Iniciar sesión</Link>
              <Link href={`/portal/${slug}/register`} className="btn-primary">Registrarme</Link>
            </>
          )}
        </div>
      </div>

      <form onSubmit={search} className="card p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Desde</label>
          <input
            type="datetime-local"
            required
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Hasta</label>
          <input
            type="datetime-local"
            required
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="input"
          />
        </div>
        {customer && categories.length > 0 && (
          <div>
            <label className="label">Categoría</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="input">
              <option value="">Todas</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <><span className="spinner" /> Buscando…</> : 'Buscar'}
        </button>
      </form>

      {error && <div className="alert alert-danger mb-6">{error}</div>}

      {results && results.length === 0 && (
        <div className="empty-state">
          <h3>Nada disponible en ese rango</h3>
          <p>Probá con otras fechas u otra categoría.</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {results.map(r => (
            <div key={r.id} className="card p-4 flex flex-col gap-3">
              <div>
                <div className="table-cell-primary text-sm">{r.name}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  ${r.basePrice.toLocaleString('es-AR')}
                </div>
              </div>
              <button onClick={() => reservar(r)} className="btn-primary mt-auto">Reservar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
