'use client'
import { useState } from 'react'
import ApiSection from '@/components/ApiSection'
import { apiFetch } from '@/lib/api'

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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes</h1>
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
                <label className="label">Threshold de subutilización (%): <span className="text-indigo-400">{threshold}%</span></label>
                <input type="range" min={0} max={100} value={threshold} onChange={e => setThreshold(e.target.value)} className="w-full accent-indigo-500 mt-1" />
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
              <p className="text-xs text-slate-500">
                Agrupa las transferencias a cuenta por cobrar por empresa, para el cierre de mes. La emisión de la factura sigue siendo manual.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Desde</label><input type="datetime-local" value={arFrom} onChange={e => setArFrom(e.target.value)} className="input" /></div>
                <div><label className="label">Hasta</label><input type="datetime-local" value={arTo} onChange={e => setArTo(e.target.value)} className="input" /></div>
              </div>
            </div>
          }
        />
      </div>
    </div>
  )
}
