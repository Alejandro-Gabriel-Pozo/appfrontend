'use client'
import { useState } from 'react'
import ApiSection from '@/components/ApiSection'

const BASE = 'https://app-chny.onrender.com'
const TYPES = ['CABIN', 'RESTAURANT_TABLE', 'SPA', 'TOUR_SEAT']

export default function RecursosPage() {
  const [filterType, setFilterType] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [availId, setAvailId] = useState('')
  const [availStart, setAvailStart] = useState('')
  const [availEnd, setAvailEnd] = useState('')

  // Create resource state
  const [crType, setCrType] = useState('CABIN')
  const [crName, setCrName] = useState('')
  const [crDesc, setCrDesc] = useState('')
  const [crCap, setCrCap] = useState('')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recursos</h1>
          <p className="page-subtitle">Gestión de cabañas, mesas, spa y tours</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Ver todos */}
        <ApiSection
          method="GET" title="Ver todos los recursos"
          endpoint="/api/resources"
          onSubmit={async () => {
            const res = await fetch(`${BASE}/api/resources`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
            return { status: res.status, data: await res.json() }
          }}
        />

        {/* Filtrar por tipo */}
        <ApiSection
          method="GET" title="Filtrar por tipo"
          endpoint={`/api/resources/type/:type`}
          onSubmit={async () => {
            const res = await fetch(`${BASE}/api/resources/type/${filterType}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
            return { status: res.status, data: await res.json() }
          }}
          formContent={
            <div>
              <label className="label">Tipo de recurso</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input">
                <option value="">Seleccionar tipo...</option>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          }
        />

        {/* Buscar por ID */}
        <ApiSection
          method="GET" title="Buscar recurso por ID"
          endpoint="/api/resources/:id"
          onSubmit={async () => {
            const res = await fetch(`${BASE}/api/resources/${resourceId}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
            return { status: res.status, data: await res.json() }
          }}
          formContent={
            <div>
              <label className="label">ID del recurso</label>
              <input value={resourceId} onChange={e => setResourceId(e.target.value)} placeholder="uuid o id..." className="input" />
            </div>
          }
        />

        {/* Disponibilidad */}
        <ApiSection
          method="GET" title="Verificar disponibilidad"
          endpoint="/api/resources/:id/availability"
          onSubmit={async () => {
            const params = new URLSearchParams({ startTime: availStart, endTime: availEnd })
            const res = await fetch(`${BASE}/api/resources/${availId}/availability?${params}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
            return { status: res.status, data: await res.json() }
          }}
          formContent={
            <div className="space-y-3">
              <div>
                <label className="label">ID del recurso</label>
                <input value={availId} onChange={e => setAvailId(e.target.value)} placeholder="uuid o id..." className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Desde</label>
                  <input type="datetime-local" value={availStart} onChange={e => setAvailStart(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Hasta</label>
                  <input type="datetime-local" value={availEnd} onChange={e => setAvailEnd(e.target.value)} className="input" />
                </div>
              </div>
            </div>
          }
        />

        {/* Crear recurso */}
        <ApiSection
          method="POST" title="Crear nuevo recurso"
          endpoint="/api/resources"
          onSubmit={async () => {
            const body = { type: crType, name: crName, description: crDesc, capacity: Number(crCap) }
            const res = await fetch(`${BASE}/api/resources`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify(body),
            })
            return { status: res.status, data: await res.json() }
          }}
          formContent={
            <div className="space-y-3">
              <div>
                <label className="label">Tipo</label>
                <select value={crType} onChange={e => setCrType(e.target.value)} className="input">
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Nombre</label>
                <input value={crName} onChange={e => setCrName(e.target.value)} placeholder="Cabaña del Río" className="input" />
              </div>
              <div>
                <label className="label">Descripción</label>
                <input value={crDesc} onChange={e => setCrDesc(e.target.value)} placeholder="Descripción opcional" className="input" />
              </div>
              <div>
                <label className="label">Capacidad</label>
                <input type="number" value={crCap} onChange={e => setCrCap(e.target.value)} placeholder="4" className="input" />
              </div>
            </div>
          }
        />
      </div>
    </div>
  )
}
