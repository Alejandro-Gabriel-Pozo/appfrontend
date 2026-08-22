import { Suspense } from 'react'
import AcceptInvitationForm from './AcceptInvitationForm'

// `AcceptInvitationForm` usa useSearchParams() (Client Component) -- Next.js
// exige envolverlo en Suspense para no romper el build de producción con
// "Missing Suspense boundary with useSearchParams" (ver docs/01-app/
// 03-api-reference/04-functions/use-search-params.md del propio Next 16).
export default function AceptarInvitacionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ backgroundColor: 'var(--bg)' }} />}>
      <AcceptInvitationForm />
    </Suspense>
  )
}
