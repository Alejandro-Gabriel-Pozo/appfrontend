'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApiBlock from '@/components/ApiBlock'

const BASE = 'https://app-chny.onrender.com'

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-xl">{icon}</span>
      <h2 className="text-base font-semibold text-white">{title}</h2>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) router.replace('/login')
  }, [router])

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-xl border transition-all
          ${toast.type === 'ok'
            ? 'bg-emerald-900/90 text-emerald-300 border-emerald-700/50'
            : 'bg-red-900/90 text-red-300 border-red-700/50'
          }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex">
        <aside className="hidden lg:flex w-56 min-h-screen bg-[#13171f] border-r border-[#1e293b] flex-col py-6 px-4 fixed left-0 top-0">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Admin Panel</span>
          </div>
          <nav className="space-y-1 flex-1">
            {['Auth','Recursos','Reservas','Reportes','Admin'].map(s => (
              <a key={s} href={`#section-${s.toLowerCase()}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-[#1e293b] transition">
                {s}
              </a>
            ))}
          </nav>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition mt-4">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </aside>

        <main className="flex-1 lg:ml-56 p-4 lg:p-8 space-y-10 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">Panel de Administración</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                API: <span className="font-mono text-slate-300">app-chny.onrender.com</span>
              </p>
            </div>
            <button onClick={handleLogout}
              className="lg:hidden text-xs text-slate-400 hover:text-red-400 border border-[#2d3748] px-3 py-1.5 rounded-lg transition">
              Salir
            </button>
          </div>

          <section id="section-auth">
            <SectionTitle icon="🔐" title="Auth" />
            <div className="space-y-3">
              <ApiBlock
                method="POST"
                label="Iniciar sesión"
                noAuth
                buildUrl={() => `${BASE}/api/login`}
                buildBody={v => ({ email: v.email, password: v.password })}
                inputs={[
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'admin@example.com', required: true },
                  { key: 'password', label: 'Contraseña', type: 'password', placeholder: '••••••••', required: true },
                ]}
                onToken={t => {
                  localStorage.setItem('token', t)
                  showToast('Token guardado correctamente ✓')
                }}
              />
            </div>
          </section>

          <section id="section-recursos">
            <SectionTitle icon="📦" title="Recursos" />
            <div className="space-y-3">
              <ApiBlock method="GET" label="Ver todos los recursos" buildUrl={() => `${BASE}/api/resources`} />
              <ApiBlock method="GET" label="Recursos por tipo"
                buildUrl={v => `${BASE}/api/resources/type/${v.type}`}
                inputs={[{ key: 'type', label: 'Tipo', options: ['CABIN','RESTAURANT_TABLE','SPA','TOUR_SEAT'], required: true }]}
              />
              <ApiBlock method="GET" label="Recurso por ID"
                buildUrl={v => `${BASE}/api/resources/${v.id}`}
                inputs={[{ key: 'id', label: 'ID del recurso', placeholder: 'ej. resource_123', required: true }]}
              />
              <ApiBlock method="GET" label="Disponibilidad de recurso"
                buildUrl={v => {
                  const params = new URLSearchParams()
                  if (v.startTime) params.set('startTime', new Date(v.startTime).toISOString())
                  if (v.endTime) params.set('endTime', new Date(v.endTime).toISOString())
                  return `${BASE}/api/resources/${v.id}/availability?${params}`
                }}
                inputs={[
                  { key: 'id', label: 'ID del recurso', placeholder: 'ej. resource_123', required: true },
                  { key: 'startTime', label: 'Desde', type: 'datetime-local', required: true },
                  { key: 'endTime', label: 'Hasta', type: 'datetime-local', required: true },
                ]}
              />
            </div>
          </section>

          <section id="section-reservas">
            <SectionTitle icon="📅" title="Reservas" />
            <div className="space-y-3">
              <ApiBlock method="GET" label="Ver todas las reservas" buildUrl={() => `${BASE}/api/reservations`} />
              <ApiBlock method="POST" label="Crear reserva"
                buildUrl={() => `${BASE}/api/reservations`}
                buildBody={v => ({
                  resourceType: v.resourceType,
                  resourceId: v.resourceId,
                  customer: { id: v.customerId, fullName: v.customerName, email: v.customerEmail },
                  startTime: v.startTime ? new Date(v.startTime).toISOString() : '',
                  endTime: v.endTime ? new Date(v.endTime).toISOString() : '',
                  details: {},
                })}
                inputs={[
                  { key: 'resourceType', label: 'Tipo de recurso', options: ['CABIN','RESTAURANT_TABLE','SPA','TOUR_SEAT'], required: true },
                  { key: 'resourceId', label: 'ID del recurso', placeholder: 'ej. resource_123', required: true },
                  { key: 'customerId', label: 'ID del cliente', placeholder: 'ej. cust_001', required: true },
                  { key: 'customerName', label: 'Nombre completo', placeholder: 'Juan Pérez', required: true },
                  { key: 'customerEmail', label: 'Email del cliente', type: 'email', placeholder: 'juan@email.com', required: true },
                  { key: 'startTime', label: 'Inicio', type: 'datetime-local', required: true },
                  { key: 'endTime', label: 'Fin', type: 'datetime-local', required: true },
                ]}
              />
              <ApiBlock method="GET" label="Reserva por ID"
                buildUrl={v => `${BASE}/api/reservations/${v.id}`}
                inputs={[{ key: 'id', label: 'ID de la reserva', placeholder: 'ej. res_001', required: true }]}
              />
              <ApiBlock method="POST" label="Confirmar reserva"
                buildUrl={v => `${BASE}/api/reservations/${v.id}/confirm`}
                inputs={[{ key: 'id', label: 'ID de la reserva', placeholder: 'ej. res_001', required: true }]}
              />
              <ApiBlock method="POST" label="Cancelar reserva"
                buildUrl={v => `${BASE}/api/reservations/${v.id}/cancel`}
                inputs={[{ key: 'id', label: 'ID de la reserva', placeholder: 'ej. res_001', required: true }]}
              />
              <ApiBlock method="POST" label="Completar reserva"
                buildUrl={v => `${BASE}/api/reservations/${v.id}/complete`}
                inputs={[{ key: 'id', label: 'ID de la reserva', placeholder: 'ej. res_001', required: true }]}
              />
            </div>
          </section>

          <section id="section-reportes">
            <SectionTitle icon="📊" title="Reportes" />
            <div className="space-y-3">
              <ApiBlock method="GET" label="Reporte de ocupación"
                buildUrl={v => {
                  const params = new URLSearchParams()
                  if (v.startDate) params.set('startDate', new Date(v.startDate).toISOString())
                  if (v.endDate) params.set('endDate', new Date(v.endDate).toISOString())
                  return `${BASE}/api/reports/occupancy?${params}`
                }}
                inputs={[
                  { key: 'startDate', label: 'Desde', type: 'datetime-local', required: true },
                  { key: 'endDate', label: 'Hasta', type: 'datetime-local', required: true },
                ]}
              />
              <ApiBlock method="GET" label="Resumen"
                buildUrl={v => {
                  const params = new URLSearchParams()
                  if (v.startDate) params.set('startDate', new Date(v.startDate).toISOString())
                  if (v.endDate) params.set('endDate', new Date(v.endDate).toISOString())
                  if (v.limit) params.set('limit', v.limit)
                  return `${BASE}/api/reports/summary?${params}`
                }}
                inputs={[
                  { key: 'startDate', label: 'Desde', type: 'datetime-local', required: true },
                  { key: 'endDate', label: 'Hasta', type: 'datetime-local', required: true },
                  { key: 'limit', label: 'Límite (default 5)', type: 'number', placeholder: '5' },
                ]}
              />
              <ApiBlock method="GET" label="Recursos subutilizados"
                buildUrl={v => {
                  const params = new URLSearchParams()
                  if (v.startDate) params.set('startDate', new Date(v.startDate).toISOString())
                  if (v.endDate) params.set('endDate', new Date(v.endDate).toISOString())
                  if (v.threshold) params.set('threshold', v.threshold)
                  return `${BASE}/api/reports/underutilized?${params}`
                }}
                inputs={[
                  { key: 'startDate', label: 'Desde', type: 'datetime-local', required: true },
                  { key: 'endDate', label: 'Hasta', type: 'datetime-local', required: true },
                  { key: 'threshold', label: 'Umbral % (0-100, default 30)', type: 'number', placeholder: '30' },
                ]}
              />
            </div>
          </section>

          <section id="section-admin" className="pb-12">
            <SectionTitle icon="⚙️" title="Admin" />
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden border border-amber-700/30 bg-amber-950/10 p-3 text-xs text-amber-400/80 mb-2 flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Requiere rol <strong>ADMIN</strong>
              </div>
              <ApiBlock method="POST" label="Activar BD del negocio" buildUrl={() => `${BASE}/api/admin/repair-tenant-db`} />
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
