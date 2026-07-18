'use client'
import { useState } from 'react'
import ApiSection from '@/components/ApiSection'

const BASE = 'https://app-chny.onrender.com'

export default function ReportesPage() {
  const [occStart, setOccStart] = useState('')
  const [occEnd, setOccEnd] = useState('')
  const [sumStart, setSumStart] = useState('')
  const [sumEnd, setSumEnd] = useState('')
  const [sumLimit, setSumLimit] = useState('5')
  const [underStart, setUnderStart] = useState('')
  const [underEnd, setUnderEnd] = useState('')
  const [threshold, setThreshold] = useState('30')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Ocupación, resumen y recursos subutilizados</p>
        </div>
      </div>

      <div className="space-y-4">
        <ApiSection
          method="GET" title="Reporte de ocupación"
          endpoint="/api/reports/occupancy"
          onSubmit={async () => {
            const params = new URLSearchParams({ startDate: occStart, endDate: occEnd })
            const res = await fetch(`${BASE}/api/reports/occupancy?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            return { status: res.status, data: await res.json() }
          }}
          formContent={
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Desde</label><input type="datetime-local" value={occStart} onChange={e => setOccStart(e.target.value)} className="input" /></div>
              <div><label className="label">Hasta</label><input type="datetime-local" value={occEnd} onChange={e => setOccEnd(e.target.value)} className="input" /></div>
            </div>
          }
        />

        <ApiSection
          method="GET" title="Resumen general"
          endpoint="/api/reports/summary"
          onSubmit={async () => {
            const params = new URLSearchParams({ startDate: sumStart, endDate: sumEnd, limit: sumLimit })
            const res = await fetch(`${BASE}/api/reports/summary?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            return { status: res.status, data: await res.json() }
          }}
          formContent={
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Desde</label><input type="datetime-local" value={sumStart} onChange={e => setSumStart(e.target.value)} className="input" /></div>
                <div><label className="label">Hasta</label><input type="datetime-local" value={sumEnd} onChange={e => setSumEnd(e.target.value)} className="input" /></div>
              </div>
              <div><label className="label">Límite de resultados</label><input type="number" value={sumLimit} onChange={e => setSumLimit(e.target.value)} min={1} max={100} className="input" /></div>
            </div>
          }
        />

        <ApiSection
          method="GET" title="Recursos subutilizados"
          endpoint="/api/reports/underutilized"
          onSubmit={async () => {
            const params = new URLSearchParams({ startDate: underStart, endDate: underEnd, threshold })
            const res = await fetch(`${BASE}/api/reports/underutilized?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            return { status: res.status, data: await res.json() }
          }}
          formContent={
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Desde</label><input type="datetime-local" value={underStart} onChange={e => setUnderStart(e.target.value)} className="input" /></div>
                <div><label className="label">Hasta</label><input type="datetime-local" value={underEnd} onChange={e => setUnderEnd(e.target.value)} className="input" /></div>
              </div>
              <div>
                <label className="label">Threshold de subutilización (%): <span className="text-indigo-400">{threshold}%</span></label>
                <input type="range" min={0} max={100} value={threshold} onChange={e => setThreshold(e.target.value)} className="w-full accent-indigo-500 mt-1" />
              </div>
            </div>
          }
        />
      </div>
    </div>
  )
}
