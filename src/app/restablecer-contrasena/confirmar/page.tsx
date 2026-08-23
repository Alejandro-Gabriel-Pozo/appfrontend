import { Suspense } from 'react'
import ConfirmPasswordResetForm from './ConfirmPasswordResetForm'

// `ConfirmPasswordResetForm` usa useSearchParams() (Client Component) --
// Next.js exige envolverlo en Suspense, mismo motivo que
// invitaciones/aceptar/page.tsx.
export default function ConfirmarResetPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }} />}>
      <ConfirmPasswordResetForm />
    </Suspense>
  )
}
