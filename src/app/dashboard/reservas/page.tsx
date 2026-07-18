'use client'
import { useState } from 'react'
import ApiSection from '@/components/ApiSection'

const BASE = 'https://app-chny.onrender.com'
const TYPES = ['CABIN', 'RESTAURANT_TABLE', 'SPA', 'TOUR_SEAT']

export default function ReservasPage() {
  const [resId, setResId] = useState('')
  const [actionId, setActionId] = useState('')

  // Nueva reserva
  const [nrType, setNrType] = useState('CABIN')
  const [nrResId, setNrResId] = useState('')
  const [nrCustId, setNrCustId] = useState('')
  const [nrCustName, setNrCustName] = useState('')
  const [nrCustEmail, setNrCustEmail] = useState('')
  const [nrStart, setNrStart] = useState('')
  const [nrEnd, setNrEnd] = useState('')
  const [nrDetails, setNrDetails] = useState('{}')

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservas</h1>
          <p className="page-subtitle">Crear, consultar y gestionar el estado de las reservas</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Ver todas */}
        <ApiSection
          method="GET" title="Ver todas las reservas"
          endpoint="/api/reservations"
          onSubmit={async () => {
            const res = await fetch(`${BASE}/api/reservations`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            return { status: res.status, data: await res.json() }
          }}
        />

        {/* Nueva reserva */}
        <ApiSection
          method="POST" title="Crear nueva reserva"
          endpoint="/api/reservations"
          onSubmit={async () => {
            let details = {}
            try { details = JSON.parse(nrDetails) } catch {}
            const body = {
              resourceType: nrType, resourceId: nrResId,
              customer: { id: nrCustId, fullName: nrCustName, email: nrCustEmail },
              startTime: nrStart ? new Date(nrStart).toISOString() : '',
              endTime: nrEnd ? new Date(nrEnd).toISOString() : '',
              details,
            }
            const res = await fetch(`${BASE}/api/reservations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify(body),
            })
            return { status: res.status, data: await res.json() }
          }}
          formContent={
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo de recurso</label>
                  <select value={nrType} onChange={e => setNrType(e.target.value)} className="input">
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">ID del recurso</label>
                  <input value={nrResId} onChange={e => setNrResId(e.target.value)} placeholder="uuid..." className="input" />
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500 pt-1">— Cliente —</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">ID cliente</label>
                  <input value={nrCustId} onChange={e => setNrCustId(e.target.value)} placeholder="id" className="input" />
                </div>
                <div>
                  <label className="label">Nombre completo</label>
                  <input value={nrCustName} onChange={e => setNrCustName(e.target.value)} placeholder="Juan García" className="input" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" value={nrCustEmail} onChange={e => setNrCustEmail(e.target.value)} placeholder="juan@email.com" className="input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Inicio</label>
                  <input type="datetime-local" value={nrStart} onChange={e => setNrStart(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Fin</label>
                  <input type="datetime-local" value={nrEnd} onChange={e => setNrEnd(e.target.value)} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Details (JSON)</label>
                <textarea value={nrDetails} onChange={e => setNrDetails(e.target.value)} rows={2} className="input font-mono text-xs" />
              </div>
            </div>
          }
        />

        {/* Buscar por ID */}
        <ApiSection
          method="GET" title="Buscar reserva por ID"
          endpoint="/api/reservations/:id"
          onSubmit={async () => {
            const res = await fetch(`${BASE}/api/reservations/${resId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            return { status: res.status, data: await res.json() }
          }}
          formContent={
            <div><label className="label">ID de reserva</label>
            <input value={resId} onChange={e => setResId(e.target.value)} placeholder="uuid..." className="input" /></div>
          }
        />

        {/* Acciones de estado */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Cambiar estado de reserva</h3>
          <div>
            <label className="label">ID de reserva</label>
            <input value={actionId} onChange={e => setActionId(e.target.value)} placeholder="uuid de la reserva..." className="input mb-4" />
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Confirmar', action: 'confirm', cls: 'btn-success' },
              { label: 'Cancelar', action: 'cancel', cls: 'btn-danger' },
              { label: 'Completar', action: 'complete', cls: 'btn-secondary' },
            ].map(({ label, action, cls }) => (
              <ActionButton
                key={action}
                label={label}
                className={cls}
                action={async () => {
                  const res = await fetch(`${BASE}/api/reservations/${actionId}/${action}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                  })
                  return { status: res.status, data: await res.json() }
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionButton({ label, className, action }: { label: string; className: string; action: () => Promise<{status:number;data:unknown}> }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{status:number;data:unknown}|null>(null)
  async function run() {
    setLoading(true)
    try { setResult(await action()) } finally { setLoading(false) }
  }
  return (
    <div>
      <button onClick={run} disabled={loading} className={className}>
        {loading && <span className="spinner" />}
        {label}
      </button>
      {result && (
        <pre className={`response-block mt-2${result.status >= 400 ? ' error' : ''}`}>
          {JSON.stringify(result.data, null, 2)}
        </pre>
      )}
    </div>
  )
}
