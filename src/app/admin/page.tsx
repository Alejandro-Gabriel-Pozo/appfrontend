'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApiBlock from '@/components/ApiBlock'
import ZuluBrand from '@/components/ZuluBrand'

// Vacío a propósito: /api/* se pide same-origin, ver next.config.js (B2).
const BASE = ''

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
    <div className="zulu min-h-screen" style={{ background: 'var(--bg)' }}>
      {toast && (
        // V2.6.3: `shadow-xl` de Tailwind -> escala del sistema. El rol no es
        // "card elevada" sino superficie FLOTANTE (un toast), así que va
        // --shadow-lg, el mismo nivel que usa `.toast`.
        // OJO: este es un TERCER sistema de toast, con colores Tailwind
        // oscuros propios (bg-emerald-900/90, bg-red-900/90). No se unifica
        // acá porque V2.6.3 es sólo elevación; queda anotado.
        <div
          style={{ boxShadow: 'var(--shadow-lg)' }}
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium border transition-all
          ${toast.type === 'ok'
            ? 'bg-emerald-900/90 text-emerald-300 border-emerald-700/50'
            : 'bg-red-900/90 text-red-300 border-red-700/50'
          }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex">
        <aside className="hidden lg:flex w-56 min-h-screen flex-col py-6 px-4 fixed left-0 top-0" style={{ background: 'var(--surface-1)', borderRight: '1px solid var(--border)' }}>
          <div className="mb-8">
            <ZuluBrand subtitle="API / OPERACIÓN" compact />
          </div>
          <nav className="space-y-1 flex-1">
            {['Auth','Recursos','Reservas','Reportes','Admin'].map(s => (
              <a key={s} href={`#section-${s.toLowerCase()}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition" style={{ color: 'var(--text-secondary)' }}>
                {s}
              </a>
            ))}
          </nav>
          <button onClick={handleLogout}
            className="btn-ghost flex items-center gap-2 px-3 py-2 rounded-lg text-sm mt-4">
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
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-zulu-display)' }}>Panel técnico de ZULU</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                API: <span className="font-mono text-slate-300">app-chny.onrender.com</span>
              </p>
            </div>
            <button onClick={handleLogout}
              className="lg:hidden btn-secondary text-xs px-3 py-1.5">
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
              <ApiBlock method="GET" label="Recurso por ID"
                buildUrl={v => `${BASE}/api/resources/${v.id}`}
                inputs={[{ key: 'id', label: 'ID del recurso', placeholder: 'ej. resource_123', required: true }]}
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
                  if (v.from) params.set('from', v.from)
                  if (v.to) params.set('to', v.to)
                  return `${BASE}/api/reports/occupancy?${params}`
                }}
                inputs={[
                  { key: 'from', label: 'Desde', type: 'date', required: true },
                  { key: 'to', label: 'Hasta', type: 'date', required: true },
                ]}
              />
              <ApiBlock method="GET" label="Resumen"
                buildUrl={v => {
                  const params = new URLSearchParams()
                  if (v.from) params.set('from', v.from)
                  if (v.to) params.set('to', v.to)
                  if (v.limit) params.set('limit', v.limit)
                  return `${BASE}/api/reports/occupancy/summary?${params}`
                }}
                inputs={[
                  { key: 'from', label: 'Desde', type: 'date', required: true },
                  { key: 'to', label: 'Hasta', type: 'date', required: true },
                  { key: 'limit', label: 'Límite (default 5)', type: 'number', placeholder: '5' },
                ]}
              />
              <ApiBlock method="GET" label="Recursos subutilizados"
                buildUrl={v => {
                  const params = new URLSearchParams()
                  if (v.from) params.set('from', v.from)
                  if (v.to) params.set('to', v.to)
                  if (v.threshold) params.set('threshold', v.threshold)
                  return `${BASE}/api/reports/occupancy/underutilized?${params}`
                }}
                inputs={[
                  { key: 'from', label: 'Desde', type: 'date', required: true },
                  { key: 'to', label: 'Hasta', type: 'date', required: true },
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
