'use client'
import { CustomerAuthProvider } from '@/context/CustomerAuthContext'
import { ToastProvider } from '@/context/ToastContext'

// Segmento raíz del portal público de clientes. Convive páginas públicas
// (login, register, disponibilidad) y protegidas (cuenta/*) bajo el mismo
// slug de negocio — el gating de las protegidas vive en cuenta/layout.tsx,
// no acá.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAuthProvider>
      <ToastProvider>
        <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
          {children}
        </div>
      </ToastProvider>
    </CustomerAuthProvider>
  )
}
