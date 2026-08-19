'use client'
import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useCustomerAuth } from '@/context/CustomerAuthContext'

export default function PortalRootPage() {
  const router = useRouter()
  const params = useParams()
  const slug = params?.businessSlug as string
  // El chequeo de sesión (cookie httpOnly + GET /api/customer/me) ya lo
  // dispara CustomerAuthProvider al montar (layout.tsx) -- acá solo se
  // espera a que resuelva.
  const { customer, isLoading } = useCustomerAuth()

  useEffect(() => {
    if (isLoading) return
    router.replace(customer ? `/portal/${slug}/cuenta/reservas` : `/portal/${slug}/disponibilidad`)
  }, [isLoading, customer, slug, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="spinner" style={{ width: 24, height: 24 }} />
    </div>
  )
}
