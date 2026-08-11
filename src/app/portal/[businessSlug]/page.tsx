'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getCustomerSessionImperative } from '@/context/CustomerAuthContext'

export default function PortalRootPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.businessSlug as string

  useEffect(() => {
    const session = getCustomerSessionImperative()
    // Una sesión de OTRO negocio (slug distinto) no cuenta como válida acá.
    const hasValidSession = session?.businessSlug === slug
    router.replace(hasValidSession ? `/portal/${slug}/cuenta/reservas` : `/portal/${slug}/disponibilidad`)
  }, [router, slug])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="spinner" style={{ width: 24, height: 24 }} />
    </div>
  )
}
